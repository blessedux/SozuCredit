-- Sozu Credit: store classic G signer for Soroban smart account (C) in stellar_wallets.
-- public_key = C… (default receive/send address in tag directory)
-- signer_public_key = G… (fee payer + passkey-derived key for signing Soroban txs)

ALTER TABLE public.stellar_wallets
  ADD COLUMN IF NOT EXISTS signer_public_key TEXT;

COMMENT ON COLUMN public.stellar_wallets.signer_public_key IS
  'Classic G signer for smart account in public_key (C). Null when public_key is legacy G only.';
