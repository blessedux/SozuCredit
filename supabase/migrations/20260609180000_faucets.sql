-- Sozu Faucet MVP (testnet): physical NFC orbs that release small USDC claims.
-- Apply in Supabase SQL editor or `supabase db push`.
-- V1 abuse rules live in the API layer (lib/db/faucets.ts):
--   one claim per wallet / 24h, one successful claim per faucet / cooldown,
--   daily faucet budget. The NFC tag only stores the entry URL.

CREATE TABLE IF NOT EXISTS public.faucets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- URL slug used by the NFC tag: https://app.sozu.capital/faucet/<slug>
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),

  -- Manually registered location for the map (the NFC chip has no GPS).
  location_name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,

  -- Economics (USDC units, 7-decimal token but stored as numeric for clarity).
  daily_limit numeric(18, 7) NOT NULL DEFAULT 10 CHECK (daily_limit > 0),
  claim_amount numeric(18, 7) NOT NULL DEFAULT 1 CHECK (claim_amount > 0),

  -- Global faucet cooldown between successful claims.
  cooldown_minutes integer NOT NULL DEFAULT 60 CHECK (cooldown_minutes >= 0),

  -- Future: per-faucet campaign vault (Soroban contract or funded account).
  vault_address text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faucet_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  faucet_id uuid NOT NULL REFERENCES public.faucets (id) ON DELETE CASCADE,

  -- Passkey user id (TEXT allows UUID-style and legacy ids, same as deposit_intents).
  user_id text NOT NULL,

  -- Destination Stellar address (C smart account or classic G).
  wallet_address text NOT NULL,

  amount numeric(18, 7) NOT NULL CHECK (amount > 0),

  -- Stored internally; never surfaced in the main success UI.
  tx_hash text,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),

  claimed_at timestamptz NOT NULL DEFAULT now(),

  -- Soft abuse signals (sha256 with server salt; no raw PII).
  ip_hash text,
  user_agent_hash text
);

-- Indexes for the V1 rule checks.
CREATE INDEX IF NOT EXISTS faucet_claims_faucet_time_idx
  ON public.faucet_claims (faucet_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS faucet_claims_wallet_time_idx
  ON public.faucet_claims (wallet_address, claimed_at DESC);

CREATE INDEX IF NOT EXISTS faucet_claims_user_time_idx
  ON public.faucet_claims (user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS faucets_status_idx
  ON public.faucets (status);

-- updated_at trigger for faucets
CREATE OR REPLACE FUNCTION public.set_faucets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS faucets_set_updated_at ON public.faucets;
CREATE TRIGGER faucets_set_updated_at
  BEFORE UPDATE ON public.faucets
  FOR EACH ROW EXECUTE FUNCTION public.set_faucets_updated_at();

-- Row Level Security
ALTER TABLE public.faucets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faucet_claims ENABLE ROW LEVEL SECURITY;

-- Anyone can read active faucets (map + claim page are public entry points).
CREATE POLICY "public read active faucets"
  ON public.faucets
  FOR SELECT
  USING (status = 'active');

-- Users can read their own claims (e.g. future history UI).
CREATE POLICY "users read own faucet claims"
  ON public.faucet_claims
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- All writes (faucet registration, claim creation/transitions) are service-role only.
-- (Service role bypasses RLS in Supabase; no explicit policies needed.)

-- Seed the first physical orb (NTAG215 tag points at /faucet/test-orb-001).
-- TESTING CONFIG: cooldown 0 and an effectively unlimited daily budget so the
-- chip can be claimed repeatedly. Wallet cooldown is disabled separately via
-- FAUCET_USER_COOLDOWN_HOURS=0. Production values: daily_limit 10, cooldown 60.
INSERT INTO public.faucets (slug, name, description, status, location_name, lat, lng, daily_limit, claim_amount, cooldown_minutes)
VALUES (
  'test-orb-001',
  'Sozu Orb 001',
  'El primer Sozu Faucet. Toca la esfera y recibe USDC de prueba.',
  'active',
  'Santiago Centro',
  -33.4446721,
  -70.6481253,
  1000000,
  1,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  claim_amount = EXCLUDED.claim_amount,
  cooldown_minutes = EXCLUDED.cooldown_minutes;
