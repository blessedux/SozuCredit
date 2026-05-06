-- Canonical commerce name from bank email (e.g. "Detalle Comercio") + user-defined display aliases.

ALTER TABLE public.ledger_transactions
  ADD COLUMN IF NOT EXISTS merchant_legal TEXT;

CREATE INDEX IF NOT EXISTS ledger_transactions_user_merchant_legal_idx
  ON public.ledger_transactions (user_id, merchant_legal)
  WHERE merchant_legal IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ledger_merchant_aliases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  legal_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_merchant_aliases_user_legal_key_uidx
  ON public.ledger_merchant_aliases (user_id, legal_key);

ALTER TABLE public.ledger_merchant_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_merchant_aliases_self" ON public.ledger_merchant_aliases
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
