-- Function to auto-create profile, trust points, and vault on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Create profile
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );

  -- Create trust points account
  insert into public.trust_points (user_id, balance)
  values (new.id, 5);

  -- Create vault
  insert into public.vaults (user_id, alias)
  values (new.id, substring(new.id::text from 1 for 8));

  return new;
end;
$$;

-- Trigger for new user creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Function to add daily trust points
create or replace function public.add_daily_trust_points()
returns void
language plpgsql
security definer
as $$
begin
  update public.trust_points
  set 
    balance = balance + 5,
    last_daily_credit = now(),
    updated_at = now()
  where 
    last_daily_credit < now() - interval '1 day';
end;
$$;
