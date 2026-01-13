-- Find duplicate accounts (multiple auth.users with same username)
-- This helps identify accounts that were created due to trigger failures

-- Find all profiles with duplicate usernames
-- (This shouldn't happen due to unique constraint, but let's check)
select 
  username,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as user_ids,
  array_agg(created_at order by created_at) as created_dates
from public.profiles
where username is not null
group by username
having count(*) > 1;

-- Find auth.users that don't have a profile (orphaned accounts)
select 
  au.id as auth_user_id,
  au.email,
  au.created_at as auth_created_at,
  au.raw_user_meta_data->>'username' as intended_username,
  (select count(*) from public.profiles p where p.username = au.raw_user_meta_data->>'username') as profiles_with_same_username
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
order by au.created_at desc;

-- Find auth.users that have profiles but with different usernames
-- (This indicates the username was modified due to conflicts)
select 
  au.id as auth_user_id,
  au.email,
  au.created_at as auth_created_at,
  au.raw_user_meta_data->>'username' as intended_username,
  p.username as actual_username,
  p.display_name,
  case 
    when au.raw_user_meta_data->>'username' != p.username then 'MISMATCH'
    else 'MATCH'
  end as status
from auth.users au
inner join public.profiles p on p.id = au.id
where au.raw_user_meta_data->>'username' is not null
  and au.raw_user_meta_data->>'username' != p.username
order by au.created_at desc;

-- Find accounts with the same intended username (alice, etc.)
-- This shows all accounts that tried to register with the same username
select 
  au.raw_user_meta_data->>'username' as intended_username,
  count(*) as account_count,
  array_agg(au.id order by au.created_at) as auth_user_ids,
  array_agg(au.created_at order by au.created_at) as created_dates,
  array_agg(
    case 
      when p.id is not null then p.username 
      else 'NO PROFILE'
    end
    order by au.created_at
  ) as actual_usernames
from auth.users au
left join public.profiles p on p.id = au.id
where au.raw_user_meta_data->>'username' is not null
group by au.raw_user_meta_data->>'username'
having count(*) > 1
order by count(*) desc;

-- Summary: Count of accounts per intended username
select 
  au.raw_user_meta_data->>'username' as intended_username,
  count(*) as total_accounts,
  count(p.id) as accounts_with_profiles,
  count(*) - count(p.id) as orphaned_accounts
from auth.users au
left join public.profiles p on p.id = au.id
where au.raw_user_meta_data->>'username' is not null
group by au.raw_user_meta_data->>'username'
having count(*) > 1
order by count(*) desc;
