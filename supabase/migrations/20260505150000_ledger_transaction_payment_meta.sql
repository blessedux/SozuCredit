-- Parsed payment receipt fields (e.g. Chile bank "Comprobante de pago" emails).
ALTER TABLE public.ledger_transactions
  ADD COLUMN IF NOT EXISTS card_last_four TEXT,
  ADD COLUMN IF NOT EXISTS cardholder_name TEXT;
