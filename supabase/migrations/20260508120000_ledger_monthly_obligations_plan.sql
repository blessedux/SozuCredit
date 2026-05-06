-- User-entered expected monthly obligations (same currency as preferred fiat); JSON array of { id, label, amount }.

ALTER TABLE public.ledger_settings
  ADD COLUMN IF NOT EXISTS monthly_obligations_plan JSONB NOT NULL DEFAULT '[]'::jsonb;
