-- Fix the handle_new_user() trigger to properly handle username conflicts
-- The trigger should check if username exists BEFORE creating the profile
-- If username exists, it should fail the transaction to prevent duplicate accounts

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
begin
  -- Get the intended username from metadata
  intended_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );

  -- Check if username already exists
  select exists(
    select 1 
    from public.profiles 
    where username = intended_username
  ) into username_exists;

  -- If username exists, raise an error to prevent duplicate account creation
  if username_exists then
    raise exception 'Username "%" is already taken. Please choose a different username.', intended_username
      using errcode = '23505'; -- Unique violation error code
  end if;

  -- Create profile with username instead of email
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
    ),
    username = coalesce(
      intended_username,
      profiles.username
    );

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

-- Note: The trigger on_auth_user_created should already exist from previous scripts
-- This script only updates the function to properly handle username conflicts
