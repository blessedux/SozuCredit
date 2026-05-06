-- Manual savings vaults (e.g. Binance) — balances are user-maintained; optional link on ledger income rows.

CREATE TABLE IF NOT EXISTS public.ledger_vaults (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  balance_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USDT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_vaults_user_idx ON public.ledger_vaults (user_id);

ALTER TABLE public.ledger_transactions
  ADD COLUMN IF NOT EXISTS source_vault_id TEXT REFERENCES public.ledger_vaults(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ledger_transactions_source_vault_idx
  ON public.ledger_transactions (user_id, source_vault_id);

ALTER TABLE public.ledger_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_vaults_self" ON public.ledger_vaults
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
