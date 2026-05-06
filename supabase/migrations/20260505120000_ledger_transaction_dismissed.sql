-- User-dismissed rows (e.g. promotional emails misclassified as expenses) stay in DB for future learning.

ALTER TABLE public.ledger_transactions
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ledger_transactions_user_active_date_idx
  ON public.ledger_transactions (user_id, date DESC)
  WHERE dismissed_at IS NULL;
