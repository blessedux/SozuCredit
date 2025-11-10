-- Fix the trigger to match the updated schema (no email column, requires username)
-- This script updates the handle_new_user() function to work with the new profiles schema

-- Drop and recreate the function with the correct schema
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Create trust points account (if not exists) with 0 balance (new users start with 0 points)
  insert into public.trust_points (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  -- Create vault (if not exists)
  insert into public.vaults (user_id, alias)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', substring(new.id::text from 1 for 8)))
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- Log the error but don't fail the transaction
    raise warning 'Error in handle_new_user trigger: %', SQLERRM;
    return new;
end;
$$;

-- Note: The trigger on_auth_users_created is already created and enabled
-- by scripts/002_create_triggers.sql. We only need to update the function above.
-- If you need to recreate the trigger, you would need superuser access, but
-- it should already be enabled from when you ran 002_create_triggers.sql

