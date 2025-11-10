-- Migration: Referral System and Trust Points Default Change
-- This migration:
-- 1. Changes default trust points from 5 to 0
-- 2. Creates referral system tables
-- 3. Updates triggers to use 0 as default

-- Step 1: Update trust_points table default to 0
alter table public.trust_points 
  alter column balance set default 0;

-- Step 2: Create referrals table to track referral codes and usage
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referral_code text unique not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  trust_points_awarded integer default 1, -- Points awarded to referrer when referral completes
  used boolean default false,
  used_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  constraint unique_referral_code unique (referral_code)
);

-- Create indexes for referrals
create index if not exists idx_referrals_referrer_id on public.referrals(referrer_id);
create index if not exists idx_referrals_referral_code on public.referrals(referral_code);
create index if not exists idx_referrals_referred_user_id on public.referrals(referred_user_id);
create index if not exists idx_referrals_used on public.referrals(used);

-- Step 3: Update handle_new_user() function to create users with 0 trust points
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
  -- Create profile
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update set
    display_name = coalesce(
      new.raw_user_meta_data ->> 'display_name',
      profiles.display_name
    );

  -- Create trust points account with 0 balance (no default points)
  insert into public.trust_points (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  -- Create vault
  insert into public.vaults (user_id, alias)
  values (new.id, substring(new.id::text from 1 for 8))
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
end;
$$;

-- Step 4: Create function to generate referral code for a user
create or replace function public.generate_referral_code(user_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  code_exists boolean;
begin
  -- Generate a unique referral code (8 characters, alphanumeric)
  loop
    new_code := upper(substring(md5(random()::text || user_uuid::text) from 1 for 8));
    
    -- Check if code already exists
    select exists(select 1 from public.referrals where referral_code = new_code) into code_exists;
    
    exit when not code_exists;
  end loop;
  
  -- Insert referral code for user
  insert into public.referrals (referrer_id, referral_code, trust_points_awarded)
  values (user_uuid, new_code, 1)
  on conflict (referral_code) do nothing;
  
  return new_code;
end;
$$;

-- Enable Row Level Security for referrals
alter table public.referrals enable row level security;

-- Referrals policies
do $$
begin
  -- Users can view their own referrals
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'referrals' 
    and policyname = 'Users can view their own referrals'
  ) then
    create policy "Users can view their own referrals"
      on public.referrals for select
      using (auth.uid() = referrer_id);
  end if;

  -- Users can insert their own referrals
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'referrals' 
    and policyname = 'Users can insert their own referrals'
  ) then
    create policy "Users can insert their own referrals"
      on public.referrals for insert
      with check (auth.uid() = referrer_id);
  end if;

  -- System can update referrals (for marking as used)
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'referrals' 
    and policyname = 'System can update referrals'
  ) then
    create policy "System can update referrals"
      on public.referrals for update
      using (true); -- Service role can update
  end if;
end $$;

