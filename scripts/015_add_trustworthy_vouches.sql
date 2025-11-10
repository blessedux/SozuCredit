-- Migration: Add Trustworthy Vouches System
-- This migration adds support for tracking trustworthy vouches for credit eligibility
-- Credit eligibility requires 5 TRUST points received from trustworthy users (not from referrals)

-- Step 1: Add columns to user_vouches table for trustworthiness tracking
alter table public.user_vouches
  add column if not exists is_trustworthy boolean default null, -- null = pending review, true = trustworthy, false = not trustworthy
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists review_notes text;

-- Create index for faster queries on trustworthiness status
create index if not exists idx_user_vouches_trustworthy on public.user_vouches(is_trustworthy) where is_trustworthy is not null;
create index if not exists idx_user_vouches_pending_review on public.user_vouches(vouched_user_id, is_trustworthy) where is_trustworthy is null;

-- Step 2: Create function to check if a user is trustworthy
-- Trustworthiness rules (MVP):
-- 1. Must have balance in wallet (not empty)
-- 2. Must have accessed and paid back credit (if they've taken any)
-- 3. Must be at least 1 month old
create or replace function public.is_user_trustworthy(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_age_months numeric;
  has_wallet_balance boolean := false;
  has_paid_back_credit boolean := true; -- Default to true if no credit taken
  has_taken_credit boolean := false;
begin
  -- Check 1: Account must be at least 1 month old
  select 
    extract(epoch from (now() - created_at)) / (30 * 24 * 60 * 60) into user_age_months
  from auth.users
  where id = user_uuid;
  
  if user_age_months is null or user_age_months < 1 then
    return false;
  end if;
  
  -- Check 2: Must have balance in wallet (not empty)
  -- A new wallet with no balance is not trustworthy
  -- Check if they have a wallet with balance > 0
  select exists(
    select 1
    from public.stellar_wallets sw
    left join lateral (
      select usdc_balance
      from public.balance_snapshots
      where wallet_id = sw.id
      order by created_at desc
      limit 1
    ) latest_balance on true
    where sw.user_id = user_uuid
      and latest_balance.usdc_balance > 0
  ) into has_wallet_balance;
  
  -- If no wallet exists or no balance, they're not trustworthy
  if not has_wallet_balance then
    -- Check if they have a wallet at all
    if not exists(select 1 from public.stellar_wallets where user_id = user_uuid) then
      return false;
    end if;
    -- If wallet exists but no balance snapshots or balance is 0, they're not trustworthy
    -- Check if there's any balance snapshot with balance > 0
    select exists(
      select 1
      from public.stellar_wallets sw
      inner join public.balance_snapshots bs on bs.wallet_id = sw.id
      where sw.user_id = user_uuid
        and bs.usdc_balance > 0
    ) into has_wallet_balance;
    
    if not has_wallet_balance then
      return false;
    end if;
  end if;
  
  -- Check 3: Must have accessed and paid back credit (if they've taken any)
  -- Check if they have any loans/credits
  -- For now, we'll check if a loans table exists, otherwise assume they haven't taken credit
  -- If they haven't taken credit, they're still trustworthy (has_paid_back_credit = true by default)
  
  -- Try to check loans table if it exists
  begin
    select exists(
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'loans'
    ) into has_taken_credit;
    
    if has_taken_credit then
      -- Check if they have any loans
      select exists(
        select 1
        from public.loans
        where user_id = user_uuid
      ) into has_taken_credit;
      
      if has_taken_credit then
        -- Check if they have at least one paid loan
        select exists(
          select 1
          from public.loans
          where user_id = user_uuid
            and status = 'paid'
        ) into has_paid_back_credit;
        
        -- If they have loans but none are paid, they're not trustworthy
        if not has_paid_back_credit then
          return false;
        end if;
      end if;
    end if;
  exception
    when others then
      -- If loans table doesn't exist, that's fine - we'll skip this check
      has_paid_back_credit := true;
  end;
  
  -- All checks passed
  return true;
end;
$$;

-- Step 3: Create function to automatically check trustworthiness when a vouch is created
-- This will be called by a trigger
-- The function auto-checks trustworthiness, but reviewers can override if needed
create or replace function public.check_vouch_trustworthiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voucher_is_trustworthy boolean;
begin
  -- Check if the voucher (person who gave the vouch) is trustworthy
  select public.is_user_trustworthy(new.voucher_id) into voucher_is_trustworthy;
  
  -- Set is_trustworthy based on the automatic check
  -- If auto-check passes, set to true
  -- If auto-check fails, set to false (reviewers can review and potentially override)
  -- null would mean pending review, but we'll use false for failed auto-checks
  new.is_trustworthy := voucher_is_trustworthy;
  
  return new;
end;
$$;

-- Step 4: Create trigger to automatically check trustworthiness on vouch creation
drop trigger if exists check_vouch_trustworthiness_trigger on public.user_vouches;
create trigger check_vouch_trustworthiness_trigger
  before insert on public.user_vouches
  for each row
  execute function public.check_vouch_trustworthiness();

-- Step 5: Create function to get trustworthy vouches count for a user
-- This counts only vouches received (not given) that are from trustworthy users
create or replace function public.get_trustworthy_vouches_count(user_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  trustworthy_count integer;
begin
  select coalesce(sum(trust_points_transferred), 0) into trustworthy_count
  from public.user_vouches
  where vouched_user_id = user_uuid
    and is_trustworthy = true;
  
  return trustworthy_count;
end;
$$;

-- Step 6: Update credit eligibility function to check for 5 trustworthy vouches
create or replace function public.can_apply_for_credit(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  trustworthy_vouches_count integer;
begin
  -- Get count of trustworthy vouches received
  select public.get_trustworthy_vouches_count(user_uuid) into trustworthy_vouches_count;
  
  -- User needs 5+ trustworthy vouches to be eligible
  return trustworthy_vouches_count >= 5;
end;
$$;

-- Step 7: Grant execute permissions
grant execute on function public.is_user_trustworthy(uuid) to authenticated;
grant execute on function public.is_user_trustworthy(uuid) to service_role;
grant execute on function public.get_trustworthy_vouches_count(uuid) to authenticated;
grant execute on function public.get_trustworthy_vouches_count(uuid) to service_role;
grant execute on function public.can_apply_for_credit(uuid) to authenticated;
grant execute on function public.can_apply_for_credit(uuid) to service_role;

-- Step 8: Add comment explaining the system
comment on column public.user_vouches.is_trustworthy is 
'Whether the voucher (person who gave the vouch) is trustworthy. null = pending review, true = trustworthy, false = not trustworthy. Credit eligibility requires 5 TRUST points from trustworthy vouches.';

comment on column public.user_vouches.reviewed_by is 
'User ID of the reviewer who manually reviewed this vouch (if manual review was required).';

comment on column public.user_vouches.reviewed_at is 
'Timestamp when this vouch was manually reviewed.';

comment on column public.user_vouches.review_notes is 
'Notes from the reviewer about why this vouch was marked as trustworthy or not.';

