-- Stellar Wallets table for Turnkey-managed Stellar wallets
create table if not exists public.stellar_wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  turnkey_wallet_id text not null unique,
  public_key text not null unique,
  network text default 'testnet' check (network in ('testnet', 'mainnet')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.stellar_wallets enable row level security;

-- Stellar Wallets policies
create policy "Users can view their own stellar wallet"
  on public.stellar_wallets for select
  using (auth.uid() = user_id);

create policy "Users can insert their own stellar wallet"
  on public.stellar_wallets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own stellar wallet"
  on public.stellar_wallets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own stellar wallet"
  on public.stellar_wallets for delete
  using (auth.uid() = user_id);

-- Create indexes for faster lookups
create index if not exists idx_stellar_wallets_user_id on public.stellar_wallets(user_id);
create index if not exists idx_stellar_wallets_public_key on public.stellar_wallets(public_key);
create index if not exists idx_stellar_wallets_turnkey_wallet_id on public.stellar_wallets(turnkey_wallet_id);

