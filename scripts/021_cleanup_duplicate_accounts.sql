-- Cleanup script for duplicate accounts
-- WARNING: Review the results from 019_find_duplicate_accounts.sql before running this
-- This script provides functions to help clean up duplicate accounts

-- Function to identify which account to keep (keeps the oldest one with a profile)
create or replace function public.identify_primary_account(intended_username text)
returns uuid
language plpgsql
security definer
as $$
declare
  primary_user_id uuid;
begin
  -- Find the oldest account with a valid profile for this username
  select au.id into primary_user_id
  from auth.users au
  inner join public.profiles p on p.id = au.id
  where au.raw_user_meta_data->>'username' = intended_username
    and p.username = intended_username
  order by au.created_at asc
  limit 1;
  
  return primary_user_id;
end;
$$;

-- Function to get orphaned accounts (auth.users without profiles)
create or replace function public.get_orphaned_accounts()
returns table (
  auth_user_id uuid,
  email text,
  intended_username text,
  created_at timestamp with time zone
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    au.id,
    au.email,
    au.raw_user_meta_data->>'username',
    au.created_at
  from auth.users au
  left join public.profiles p on p.id = au.id
  where p.id is null
  order by au.created_at desc;
end;
$$;

-- View to see duplicate account summary
create or replace view public.duplicate_accounts_summary as
select 
  au.raw_user_meta_data->>'username' as intended_username,
  count(*) as total_accounts,
  count(p.id) as accounts_with_profiles,
  count(*) - count(p.id) as orphaned_accounts,
  min(au.created_at) as first_account_created,
  max(au.created_at) as last_account_created,
  array_agg(au.id order by au.created_at) as all_user_ids
from auth.users au
left join public.profiles p on p.id = au.id
where au.raw_user_meta_data->>'username' is not null
group by au.raw_user_meta_data->>'username'
having count(*) > 1
order by count(*) desc;

-- Grant access to view
grant select on public.duplicate_accounts_summary to authenticated;

-- Example queries to use:

-- 1. See all duplicate accounts
-- select * from public.duplicate_accounts_summary;

-- 2. See orphaned accounts
-- select * from public.get_orphaned_accounts();

-- 3. Identify primary account for a username
-- select public.identify_primary_account('alice');

-- 4. Manual cleanup example (DO NOT RUN WITHOUT REVIEW):
-- 
-- -- Step 1: Identify the account to keep
-- select public.identify_primary_account('alice');
--
-- -- Step 2: Delete orphaned accounts (auth.users without profiles)
-- -- WARNING: This will delete auth.users entries. Make sure you want to do this!
-- -- delete from auth.users 
-- -- where id in (
-- --   select auth_user_id from public.get_orphaned_accounts()
-- --   where intended_username = 'alice'
-- -- );
--
-- -- Step 3: Delete duplicate profiles (keep only the oldest one)
-- -- WARNING: This will delete profiles. Make sure you want to do this!
-- -- delete from public.profiles
-- -- where username = 'alice'
-- --   and id != (select public.identify_primary_account('alice'));
