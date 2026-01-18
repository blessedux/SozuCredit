-- Fix username uniqueness issue
-- The problem: The trigger's ON CONFLICT clause was updating usernames without checking if they're already taken
-- This script fixes the trigger to properly enforce username uniqueness

-- First, let's verify the unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'profiles_username_key' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    RAISE NOTICE 'Added unique constraint on profiles.username';
  ELSE
    RAISE NOTICE 'Unique constraint on profiles.username already exists';
  END IF;
END $$;

-- Fix the trigger function to check username uniqueness even in ON CONFLICT clause
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_code_param text;
  referrer_id_found uuid;
  intended_username text;
  username_exists boolean;
  existing_username text;
begin
  -- Get the intended username from metadata
  intended_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );

  -- Check if profile already exists for this user
  select username into existing_username
  from public.profiles
  where id = new.id;

  -- If profile exists, check if we're trying to change the username
  if existing_username is not null then
    -- Profile already exists - don't change the username
    -- This prevents username conflicts when the trigger runs multiple times
    intended_username := existing_username;
  else
    -- Profile doesn't exist - check if username is already taken by another user
    select exists(
      select 1 
      from public.profiles 
      where username = intended_username
        and id != new.id  -- Exclude current user
    ) into username_exists;

    -- If username exists for another user, raise an error
    if username_exists then
      raise exception 'Username "%" is already taken. Please choose a different username.', intended_username
        using errcode = '23505'; -- Unique violation error code
    end if;
  end if;

  -- Create or update profile with username
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      intended_username
    ),
    intended_username
  )
  on conflict (id) do update set
    display_name = coalesce(
      new.raw_user_meta_data ->> 'display_name',
      profiles.display_name
    );
    -- DO NOT update username in ON CONFLICT - it's immutable once set
    -- This prevents username conflicts

  -- Create trust points account with 0 balance (no default points)
  insert into public.trust_points (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  -- Create vault (if not exists)
  insert into public.vaults (user_id, alias)
  values (new.id, intended_username)
  on conflict (user_id) do nothing;

  -- Check if user signed up with a referral code
  referral_code_param := new.raw_user_meta_data ->> 'referral_code';
  
  if referral_code_param is not null then
    -- Find the referrer by referral code
    select referrer_id into referrer_id_found
    from public.referrals
    where referral_code = referral_code_param
      and used = false
      and referrer_id != new.id; -- Can't refer yourself
    
    if referrer_id_found is not null then
      -- Mark referral as used
      update public.referrals
      set 
        referred_user_id = new.id,
        used = true,
        used_at = now()
      where referral_code = referral_code_param
        and used = false;
        
      -- Award trust points to referrer
      update public.trust_points
      set 
        balance = balance + (
          select trust_points_awarded 
          from public.referrals 
          where referral_code = referral_code_param
        ),
        updated_at = now()
      where user_id = referrer_id_found;
      
      -- Create notification for referrer
      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) values (
        referrer_id_found,
        'referral_completed',
        'Referral Successful!',
        'Someone signed up using your referral code. You received trust points!',
        jsonb_build_object(
          'referral_code', referral_code_param,
          'referred_user_id', new.id,
          'trust_points_awarded', (select trust_points_awarded from public.referrals where referral_code = referral_code_param)
        )
      );
    end if;
  end if;

  return new;
exception
  when unique_violation then
    -- Re-raise unique violation errors (including username conflicts)
    -- This will prevent the auth.users entry from being created
    raise;
  when others then
    -- Log other errors but don't fail the transaction
    -- This allows registration to continue even if non-critical parts fail
    raise warning 'Error in handle_new_user trigger: %', SQLERRM;
    return new;
end;
$$;

-- Create a function to find duplicate usernames
create or replace function public.find_duplicate_usernames()
returns table (
  username text,
  duplicate_count bigint,
  user_ids uuid[],
  created_dates timestamp with time zone[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    p.username,
    count(*)::bigint as duplicate_count,
    array_agg(p.id order by p.created_at) as user_ids,
    array_agg(p.created_at order by p.created_at) as created_dates
  from public.profiles p
  where p.username is not null
  group by p.username
  having count(*) > 1;
end;
$$;

-- Grant execute permission to authenticated users (for diagnostics)
grant execute on function public.find_duplicate_usernames() to authenticated;

-- Comment explaining the fix
comment on function public.handle_new_user() is 
'Creates profile on user signup. Username is immutable once set to prevent duplicates. 
The ON CONFLICT clause does NOT update username to prevent conflicts.';
