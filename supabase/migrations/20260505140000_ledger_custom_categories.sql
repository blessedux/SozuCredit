-- User-defined ledger category slugs (merged with DEFAULT_CATEGORIES in the app).
ALTER TABLE public.ledger_settings
  ADD COLUMN IF NOT EXISTS custom_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
