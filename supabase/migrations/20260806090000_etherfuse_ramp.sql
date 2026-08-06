-- Etherfuse BRL/PIX ramp: per-user provider customers + on/off ramp orders.
-- Treasury-hop model: Etherfuse settles against the Sozu treasury G account;
-- server forwards/relays to the user's smart account (C…).

CREATE TABLE IF NOT EXISTS public.ramp_customers (
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'etherfuse',
  -- Client(=server)-generated UUID; IS the Etherfuse organization id. Permanent.
  customer_id text NOT NULL,
  -- Real, receivable inbox — Etherfuse emails a KYC PIN even in sandbox.
  kyc_email text NOT NULL,
  display_name text NOT NULL,
  bank_account_id text,
  wallet_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.ramp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'etherfuse',
  direction text NOT NULL CHECK (direction IN ('on', 'off')),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','awaiting_payment','funded','settling','completed','failed','refunded')),
  fiat_currency text NOT NULL DEFAULT 'BRL',
  -- BRL centavos.
  fiat_amount_minor bigint NOT NULL CHECK (fiat_amount_minor > 0),
  -- USDC minor units (1 USDC = 10_000_000).
  usdc_minor bigint NOT NULL CHECK (usdc_minor > 0),
  fx_rate numeric(24, 8) NOT NULL,
  -- Provider fee in the SOURCE asset's minor units.
  fee_minor bigint NOT NULL DEFAULT 0,
  -- Server-generated UUID sent to the provider; the idempotency key.
  provider_order_id text NOT NULL UNIQUE,
  -- off-ramp: the user's C→treasury Soroban tx. on-ramp: null.
  user_tx_hash text,
  -- on-ramp: treasury→user forward tx. off-ramp: treasury→anchor memo payment tx.
  settlement_tx_hash text,
  -- Settlement lease: set when a reconciler claims the funded→settling row
  -- (or re-claims a stale settling retry) for the treasury forward, so a
  -- crashed claimer's lease expires and a later sweep can safely re-claim
  -- instead of both callers sending.
  settlement_claimed_at timestamptz,
  -- on-ramp: the user's smart account that receives the forward.
  destination_stellar_address text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ramp_orders_user_created_idx
  ON public.ramp_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ramp_orders_status_idx
  ON public.ramp_orders (status);
-- Off-ramp replay guard: the same signed C→treasury envelope must never fund
-- two orders. Partial (NULLs — on-ramp rows and not-yet-funded off-ramp rows
-- carry no user_tx_hash) so it only constrains rows that actually recorded a
-- submitted envelope's tx hash.
CREATE UNIQUE INDEX IF NOT EXISTS ramp_orders_user_tx_hash_uidx
  ON public.ramp_orders (user_tx_hash) WHERE user_tx_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_ramp_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ramp_customers_set_updated_at ON public.ramp_customers;
CREATE TRIGGER ramp_customers_set_updated_at
  BEFORE UPDATE ON public.ramp_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_ramp_updated_at();

DROP TRIGGER IF EXISTS ramp_orders_set_updated_at ON public.ramp_orders;
CREATE TRIGGER ramp_orders_set_updated_at
  BEFORE UPDATE ON public.ramp_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_ramp_updated_at();

ALTER TABLE public.ramp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramp_orders ENABLE ROW LEVEL SECURITY;

-- Users read their own rows; ALL writes go through the service role
-- (state transitions are server-authoritative — no user INSERT/UPDATE policies).
DROP POLICY IF EXISTS "users read own ramp customers" ON public.ramp_customers;
CREATE POLICY "users read own ramp customers"
  ON public.ramp_customers FOR SELECT USING (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "users read own ramp orders" ON public.ramp_orders;
CREATE POLICY "users read own ramp orders"
  ON public.ramp_orders FOR SELECT USING (auth.uid()::text = user_id);
