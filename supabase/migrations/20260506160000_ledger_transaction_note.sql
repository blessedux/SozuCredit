-- Optional short free-text note for each ledger transaction.
ALTER TABLE public.ledger_transactions
  ADD COLUMN IF NOT EXISTS note TEXT;
