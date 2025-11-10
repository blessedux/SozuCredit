-- Fix: Update handle_new_user() trigger to create users with 0 trust points
-- This ensures the trigger matches the referral system requirements

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_code_param text;
  referrer_id_found uuid;
begin
  -- Create profile with username instead of email
  -- Get username from raw_user_meta_data or use email prefix as fallback
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update set
    display_name = coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'username',
      profiles.display_name
    ),
    username = coalesce(
      new.raw_user_meta_data ->> 'username',
      profiles.username
    );

  -- Create trust points account with 0 balance (no default points)
  insert into public.trust_points (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  -- Create vault (if not exists)
  insert into public.vaults (user_id, alias)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', substring(new.id::text from 1 for 8)))
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
  when others then
    -- Log the error but don't fail the transaction
    raise warning 'Error in handle_new_user trigger: %', SQLERRM;
    return new;
end;
$$;

-- Note: The trigger on_auth_user_created should already exist from previous scripts
-- This script only updates the function to use 0 trust points and handle referrals

