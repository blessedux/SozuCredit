-- Closed beta fiat deposit intents (bank transfer + card via SumUp).
-- Apply in Supabase SQL editor or `supabase db push`.
-- See docs/deployment-two-domains.md for context.

CREATE TABLE IF NOT EXISTS public.deposit_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner: Supabase auth user. TEXT allows both UUID-style and legacy numeric IDs.
  user_id text NOT NULL,

  method text NOT NULL CHECK (method IN ('bank_transfer', 'card')),

  -- Amount in Chilean pesos (smallest unit = 1 CLP; no cents).
  amount_clp bigint NOT NULL CHECK (amount_clp > 0),

  -- Equivalent USDC in "minor" units (7 decimal places, i.e. 1 USDC = 10_000_000 minor).
  quoted_usdc_minor bigint NOT NULL CHECK (quoted_usdc_minor > 0),

  -- FX rate at time of quote: how many CLP per 1 USDC.
  fx_clp_per_usdc numeric(24, 8) NOT NULL,

  status text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',
      'awaiting_payment',
      'payment_received',
      'pending_admin_review',
      'approved',
      'usdc_released',
      'completed',
      'failed',
      'refunded',
      'flagged'
    )),

  -- The Stellar address (G… or C…) that will receive USDC on approval.
  destination_stellar_address text NOT NULL,

  -- Short alphanumeric code the user puts in the wire transfer description for matching.
  bank_reference text UNIQUE,

  -- SumUp checkout id (Phase 4).
  sumup_checkout_id text,
  -- SumUp authoritative transaction id — source of truth for card payment (Phase 4).
  sumup_transaction_id text,

  -- Stellar transaction hash after USDC is released.
  stellar_tx_hash text,

  -- Admin who approved/released (uuid or staff id).
  approved_by text,
  approved_at timestamptz,

  -- Free-form blob: SumUp webhook payloads, admin notes, proof-of-payment references, etc.
  metadata jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS deposit_intents_user_created_idx
  ON public.deposit_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deposit_intents_status_idx
  ON public.deposit_intents (status);

CREATE INDEX IF NOT EXISTS deposit_intents_bank_reference_idx
  ON public.deposit_intents (bank_reference)
  WHERE bank_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS deposit_intents_sumup_checkout_idx
  ON public.deposit_intents (sumup_checkout_id)
  WHERE sumup_checkout_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_deposit_intents_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deposit_intents_set_updated_at ON public.deposit_intents;
CREATE TRIGGER deposit_intents_set_updated_at
  BEFORE UPDATE ON public.deposit_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_deposit_intents_updated_at();

-- Row Level Security
ALTER TABLE public.deposit_intents ENABLE ROW LEVEL SECURITY;

-- Users can read their own intents.
CREATE POLICY "users read own deposit intents"
  ON public.deposit_intents
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own intents (API route validates + sets all fields server-side).
CREATE POLICY "users insert own deposit intents"
  ON public.deposit_intents
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update only the metadata field on their own awaiting_payment intent
-- (e.g. to attach proof-of-payment reference). All other transitions are service-role only.
CREATE POLICY "users update own awaiting metadata"
  ON public.deposit_intents
  FOR UPDATE
  USING (
    auth.uid()::text = user_id
    AND status = 'awaiting_payment'
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND status = 'awaiting_payment'
  );

-- Service role bypasses RLS for admin transitions and SumUp webhook updates.
-- (No explicit policy needed; service_role always bypasses RLS in Supabase.)
