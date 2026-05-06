-- Rules learned from user actions (category / skip junk). match_text is stored normalized (lowercase) by the app.

ALTER TABLE public.category_rules
  ADD COLUMN IF NOT EXISTS skip_sync BOOLEAN NOT NULL DEFAULT FALSE;

-- One rule per user per match phrase (app always lowercases match_text before upsert).
CREATE UNIQUE INDEX IF NOT EXISTS category_rules_user_match_unique
  ON public.category_rules (user_id, match_text);
