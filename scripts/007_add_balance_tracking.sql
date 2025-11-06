-- Add balance tracking to stellar_wallets table
-- This migration adds previous_usdc_balance column for tracking previous balance state
-- and creates a balance_snapshots table for historical tracking

-- Add previous_usdc_balance column to stellar_wallets table
alter table public.stellar_wallets
add column if not exists previous_usdc_balance numeric(20, 7) default null;

-- Add comment to explain the column
comment on column public.stellar_wallets.previous_usdc_balance is 
'Previous USDC balance used for auto-deposit detection. Updated when balance changes are detected.';

-- Create balance_snapshots table for historical tracking
-- This allows us to track balance changes over time for debugging and analytics
create table if not exists public.balance_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.stellar_wallets(id) on delete cascade,
  usdc_balance numeric(20, 7) not null,
  previous_balance numeric(20, 7),
  balance_change numeric(20, 7) generated always as (usdc_balance - coalesce(previous_balance, 0)) stored,
  snapshot_type text default 'poll' check (snapshot_type in ('poll', 'webhook', 'manual', 'auto_deposit_trigger')),
  auto_deposit_triggered boolean default false,
  deposit_amount numeric(20, 7),
  transaction_hash text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.balance_snapshots enable row level security;

-- Balance Snapshots policies
create policy "Users can view their own balance snapshots"
  on public.balance_snapshots for select
  using (auth.uid() = user_id);

create policy "Service can insert balance snapshots"
  on public.balance_snapshots for insert
  with check (true);

create policy "Service can update balance snapshots"
  on public.balance_snapshots for update
  using (true);

-- Create indexes for faster lookups
create index if not exists idx_balance_snapshots_user_id on public.balance_snapshots(user_id);
create index if not exists idx_balance_snapshots_wallet_id on public.balance_snapshots(wallet_id);
create index if not exists idx_balance_snapshots_created_at on public.balance_snapshots(created_at desc);
create index if not exists idx_balance_snapshots_auto_deposit on public.balance_snapshots(auto_deposit_triggered) where auto_deposit_triggered = true;

-- Create a function to update previous_usdc_balance when balance changes
-- This can be called from application code after balance checks
create or replace function public.update_previous_usdc_balance(
  p_user_id uuid,
  p_current_balance numeric(20, 7)
) returns void as $$
begin
  update public.stellar_wallets
  set 
    previous_usdc_balance = coalesce(
      (select usdc_balance from public.balance_snapshots 
       where user_id = p_user_id 
       order by created_at desc 
       limit 1),
      previous_usdc_balance
    ),
    updated_at = now()
  where user_id = p_user_id;
  
  -- Also update the current balance as previous if it exists
  update public.stellar_wallets
  set previous_usdc_balance = p_current_balance
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function public.update_previous_usdc_balance(uuid, numeric) to authenticated;
grant execute on function public.update_previous_usdc_balance(uuid, numeric) to service_role;

