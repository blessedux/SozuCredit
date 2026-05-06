-- Link manual vault rows to Goals (local) so we can sync without duplicates.
-- Goals live in browser storage but we persist the goal id on the user's vault row.

ALTER TABLE public.ledger_vaults
  ADD COLUMN IF NOT EXISTS source_goal_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_vaults_user_source_goal_id_uniq
  ON public.ledger_vaults (user_id, source_goal_id)
  WHERE source_goal_id IS NOT NULL;

