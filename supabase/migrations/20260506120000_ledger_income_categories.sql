-- Income-only custom category slugs (merged with DEFAULT_INCOME_CATEGORIES in the app).
ALTER TABLE public.ledger_settings
  ADD COLUMN IF NOT EXISTS custom_income_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
