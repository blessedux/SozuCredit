-- Make turnkey_wallet_id nullable to support non-Turnkey wallets
-- This allows wallets created with Stellar SDK to have null turnkey_wallet_id

-- First, drop the unique constraint on turnkey_wallet_id since we'll allow nulls
-- (PostgreSQL allows multiple nulls in a unique column, but we need to handle this carefully)
alter table if exists public.stellar_wallets 
  drop constraint if exists stellar_wallets_turnkey_wallet_id_key;

-- Make turnkey_wallet_id nullable
alter table if exists public.stellar_wallets 
  alter column turnkey_wallet_id drop not null;

-- Create a partial unique index that only applies to non-null values
-- This ensures uniqueness for Turnkey wallets while allowing multiple nulls
create unique index if not exists idx_stellar_wallets_turnkey_wallet_id_unique 
  on public.stellar_wallets(turnkey_wallet_id) 
  where turnkey_wallet_id is not null;

-- Ensure public_key index exists (should already exist from 006_add_stellar_wallets.sql)
create index if not exists idx_stellar_wallets_public_key on public.stellar_wallets(public_key);

-- Add a comment explaining the change
comment on column public.stellar_wallets.turnkey_wallet_id is 
  'Turnkey wallet ID (nullable). Null for wallets created with Stellar SDK directly. Public key is used as identifier for non-Turnkey wallets.';
