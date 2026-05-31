-- OpenZeppelin passkey smart accounts (C) + optional factory signer (G)

ALTER TABLE public.stellar_wallets
  ADD COLUMN IF NOT EXISTS signer_public_key TEXT;

ALTER TABLE public.stellar_wallets
  ADD COLUMN IF NOT EXISTS wallet_type TEXT;

ALTER TABLE public.stellar_wallets
  ADD COLUMN IF NOT EXISTS oz_credential_id TEXT;

COMMENT ON COLUMN public.stellar_wallets.wallet_type IS
  'oz = OpenZeppelin passkey smart account; factory = G-signer Soroban C; legacy = classic G only';

COMMENT ON COLUMN public.stellar_wallets.oz_credential_id IS
  'WebAuthn credential id (base64url) when wallet_type = oz';
