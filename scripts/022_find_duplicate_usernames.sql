-- Diagnostic script to find duplicate usernames
-- Run this to identify any existing duplicate usernames in the database

-- Find all profiles with duplicate usernames
-- This should return 0 rows if the unique constraint is working properly
select 
  username,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as user_ids,
  array_agg(created_at order by created_at) as created_dates,
  array_agg(display_name order by created_at) as display_names
from public.profiles
where username is not null
group by username
having count(*) > 1
order by duplicate_count desc, username;

-- Show detailed information for each duplicate username
with duplicates as (
  select 
    username,
    count(*) as duplicate_count
  from public.profiles
  where username is not null
  group by username
  having count(*) > 1
)
select 
  p.username,
  p.id as user_id,
  p.display_name,
  p.created_at,
  au.email as auth_email,
  au.created_at as auth_created_at,
  au.raw_user_meta_data->>'username' as intended_username,
  (select count(*) from public.stellar_wallets sw where sw.user_id = p.id) as wallet_count
from public.profiles p
inner join duplicates d on d.username = p.username
left join auth.users au on au.id = p.id
order by p.username, p.created_at;

-- Summary: Count of accounts per username
select 
  username,
  count(*) as total_accounts,
  min(created_at) as first_created,
  max(created_at) as last_created,
  array_agg(id order by created_at) as user_ids
from public.profiles
where username is not null
group by username
having count(*) > 1
order by count(*) desc;
