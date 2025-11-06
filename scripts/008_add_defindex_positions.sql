-- DeFindex Positions and Transactions Tables
-- Phase 2: Database schema for strategy positions and transaction tracking
-- This migration creates tables to track user positions in DeFindex strategies
-- and all transactions (deposits, withdrawals, harvests)

-- Strategy positions table
-- Tracks user's position in each DeFindex strategy
create table if not exists public.defindex_positions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_address text not null,
  shares numeric(20, 7) not null default 0,
  total_deposited numeric(20, 7) not null default 0,
  total_withdrawn numeric(20, 7) not null default 0,
  last_deposit_at timestamp with time zone,
  last_withdrawal_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, strategy_address)
);

-- Strategy transactions table
-- Tracks all transactions (deposits, withdrawals, harvests) for audit and history
create table if not exists public.defindex_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid references public.defindex_positions(id) on delete cascade,
  transaction_hash text not null unique,
  transaction_type text not null check (transaction_type in ('deposit', 'withdraw', 'harvest')),
  amount numeric(20, 7) not null,
  shares numeric(20, 7),
  strategy_address text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone,
  error_message text
);

-- Enable Row Level Security
alter table public.defindex_positions enable row level security;
alter table public.defindex_transactions enable row level security;

-- Defindex Positions policies
create policy "Users can view their own positions"
  on public.defindex_positions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own positions"
  on public.defindex_positions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own positions"
  on public.defindex_positions for update
  using (auth.uid() = user_id);

create policy "Service can manage positions"
  on public.defindex_positions for all
  using (true);

-- Defindex Transactions policies
create policy "Users can view their own transactions"
  on public.defindex_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on public.defindex_transactions for insert
  with check (auth.uid() = user_id);

create policy "Service can manage transactions"
  on public.defindex_transactions for all
  using (true);

-- Create indexes for faster lookups
create index if not exists idx_defindex_positions_user_id on public.defindex_positions(user_id);
create index if not exists idx_defindex_positions_strategy on public.defindex_positions(strategy_address);
create index if not exists idx_defindex_positions_user_strategy on public.defindex_positions(user_id, strategy_address);

create index if not exists idx_defindex_transactions_user_id on public.defindex_transactions(user_id);
create index if not exists idx_defindex_transactions_position_id on public.defindex_transactions(position_id);
create index if not exists idx_defindex_transactions_hash on public.defindex_transactions(transaction_hash);
create index if not exists idx_defindex_transactions_status on public.defindex_transactions(status);
create index if not exists idx_defindex_transactions_type on public.defindex_transactions(transaction_type);
create index if not exists idx_defindex_transactions_strategy on public.defindex_transactions(strategy_address);
create index if not exists idx_defindex_transactions_created_at on public.defindex_transactions(created_at desc);

-- Create function to update position after deposit
create or replace function public.update_position_on_deposit(
  p_user_id uuid,
  p_strategy_address text,
  p_amount numeric(20, 7),
  p_shares numeric(20, 7)
) returns uuid as $$
declare
  v_position_id uuid;
begin
  -- Insert or update position
  insert into public.defindex_positions (
    user_id,
    strategy_address,
    shares,
    total_deposited,
    last_deposit_at,
    updated_at
  )
  values (
    p_user_id,
    p_strategy_address,
    p_shares,
    p_amount,
    now(),
    now()
  )
  on conflict (user_id, strategy_address) 
  do update set
    shares = defindex_positions.shares + p_shares,
    total_deposited = defindex_positions.total_deposited + p_amount,
    last_deposit_at = now(),
    updated_at = now()
  returning id into v_position_id;
  
  return v_position_id;
end;
$$ language plpgsql security definer;

-- Create function to update position after withdrawal
create or replace function public.update_position_on_withdrawal(
  p_user_id uuid,
  p_strategy_address text,
  p_amount numeric(20, 7),
  p_shares numeric(20, 7)
) returns uuid as $$
declare
  v_position_id uuid;
begin
  -- Update position
  update public.defindex_positions
  set
    shares = shares - p_shares,
    total_withdrawn = total_withdrawn + p_amount,
    last_withdrawal_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and strategy_address = p_strategy_address
  returning id into v_position_id;
  
  return v_position_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.update_position_on_deposit(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.update_position_on_deposit(uuid, text, numeric, numeric) to service_role;
grant execute on function public.update_position_on_withdrawal(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.update_position_on_withdrawal(uuid, text, numeric, numeric) to service_role;

-- Add comments for documentation
comment on table public.defindex_positions is 'Tracks user positions (shares) in DeFindex strategies';
comment on table public.defindex_transactions is 'Tracks all transactions (deposits, withdrawals, harvests) for audit and history';
comment on column public.defindex_positions.shares is 'Number of shares user owns in the strategy';
comment on column public.defindex_positions.total_deposited is 'Total amount deposited over time';
comment on column public.defindex_positions.total_withdrawn is 'Total amount withdrawn over time';
comment on column public.defindex_transactions.transaction_hash is 'Unique Stellar transaction hash';
comment on column public.defindex_transactions.status is 'Transaction status: pending, confirmed, or failed';

