-- Email ledger + Gmail pipeline. Apply in Supabase SQL editor or `supabase db push`.
-- Server routes should use the service role key for dev (x-user-id) flows; JWT users may use the anon client with RLS.

CREATE TABLE IF NOT EXISTS public.ledger_settings (
  user_id TEXT PRIMARY KEY,
  preferred_fiat_currency TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  from_addr TEXT,
  subject TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  raw_text TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_sources_user_idx ON public.email_sources (user_id);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  source_email_id TEXT REFERENCES public.email_sources(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  merchant TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_transactions_user_date_idx
  ON public.ledger_transactions (user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fx_rates_base_quote_fetched_idx
  ON public.fx_rates (base_currency, quote_currency, fetched_at);

CREATE TABLE IF NOT EXISTS public.category_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  match_text TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS category_rules_user_idx ON public.category_rules (user_id);

ALTER TABLE public.ledger_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_settings_self" ON public.ledger_settings
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "gmail_connections_self" ON public.gmail_connections
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "email_sources_self" ON public.email_sources
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "ledger_transactions_self" ON public.ledger_transactions
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "category_rules_self" ON public.category_rules
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "fx_rates_deny" ON public.fx_rates FOR SELECT USING (false);
