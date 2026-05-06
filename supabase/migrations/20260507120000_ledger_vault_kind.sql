-- Asset vs liability manual vaults (savings vs debt); default existing rows to savings.

ALTER TABLE public.ledger_vaults
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'asset';

ALTER TABLE public.ledger_vaults
  DROP CONSTRAINT IF EXISTS ledger_vaults_kind_check;

ALTER TABLE public.ledger_vaults
  ADD CONSTRAINT ledger_vaults_kind_check CHECK (kind IN ('asset', 'liability'));
