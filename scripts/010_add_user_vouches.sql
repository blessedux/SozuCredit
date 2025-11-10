-- Migration: Add user_vouches table and notifications table
-- This migration adds support for tracking user-to-user vouches and notifications

-- Create user_vouches table to track who vouched for whom
create table if not exists public.user_vouches (
  id uuid primary key default uuid_generate_v4(),
  voucher_id uuid not null references auth.users(id) on delete cascade,
  vouched_user_id uuid not null references auth.users(id) on delete cascade,
  trust_points_transferred integer not null check (trust_points_transferred > 0),
  message text,
  created_at timestamp with time zone default now(),
  constraint no_self_vouch check (voucher_id != vouched_user_id)
);

-- Create index for faster queries
create index if not exists idx_user_vouches_voucher on public.user_vouches(voucher_id);
create index if not exists idx_user_vouches_vouched_user on public.user_vouches(vouched_user_id);
create index if not exists idx_user_vouches_created_at on public.user_vouches(created_at desc);

-- Create notifications table if it doesn't exist
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'vouch_received', 'daily_credit_available', 'credit_eligible', etc.
  title text not null,
  message text,
  read boolean default false,
  metadata jsonb, -- Additional data (e.g., vouch_id, trust_points, etc.)
  created_at timestamp with time zone default now()
);

-- Create index for notifications
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(user_id, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_type on public.notifications(type);

-- Enable Row Level Security
alter table public.user_vouches enable row level security;
alter table public.notifications enable row level security;

-- User vouches policies (only create if they don't exist)
do $$
begin
  -- Check and create "Users can view vouches they gave" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_vouches' 
    and policyname = 'Users can view vouches they gave'
  ) then
    create policy "Users can view vouches they gave"
      on public.user_vouches for select
      using (auth.uid() = voucher_id);
  end if;

  -- Check and create "Users can view vouches they received" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_vouches' 
    and policyname = 'Users can view vouches they received'
  ) then
    create policy "Users can view vouches they received"
      on public.user_vouches for select
      using (auth.uid() = vouched_user_id);
  end if;

  -- Check and create "Users can insert vouches they give" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_vouches' 
    and policyname = 'Users can insert vouches they give'
  ) then
    create policy "Users can insert vouches they give"
      on public.user_vouches for insert
      with check (auth.uid() = voucher_id);
  end if;
end $$;

-- Notifications policies (only create if they don't exist)
do $$
begin
  -- Check and create "Users can view their own notifications" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'notifications' 
    and policyname = 'Users can view their own notifications'
  ) then
    create policy "Users can view their own notifications"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;

  -- Check and create "Users can update their own notifications" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'notifications' 
    and policyname = 'Users can update their own notifications'
  ) then
    create policy "Users can update their own notifications"
      on public.notifications for update
      using (auth.uid() = user_id);
  end if;

  -- Check and create "System can insert notifications" policy
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'notifications' 
    and policyname = 'System can insert notifications'
  ) then
    create policy "System can insert notifications"
      on public.notifications for insert
      with check (true); -- System inserts via service role
  end if;
end $$;

-- Add username column to profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'username'
  ) then
    alter table public.profiles add column username text unique;
    create index if not exists idx_profiles_username on public.profiles(username);
  end if;
end $$;

-- Add evm_address column to profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'evm_address'
  ) then
    alter table public.profiles add column evm_address text;
    create index if not exists idx_profiles_evm_address on public.profiles(evm_address);
  end if;
end $$;

-- Function to create notification when vouch is received
create or replace function public.notify_vouch_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voucher_username text;
  vouched_user_username text;
begin
  -- Get voucher's username
  select username into voucher_username
  from public.profiles
  where id = new.voucher_id;
  
  select username into vouched_user_username
  from public.profiles
  where id = new.vouched_user_id;
  
  -- Create notification for the user who received the vouch
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) values (
    new.vouched_user_id,
    'vouch_received',
    'You received a vouch!',
    coalesce(
      case 
        when new.message is not null then 
          coalesce(voucher_username, 'Someone') || ' vouched for you with ' || new.trust_points_transferred || ' trust point(s). Message: ' || new.message
        else 
          coalesce(voucher_username, 'Someone') || ' vouched for you with ' || new.trust_points_transferred || ' trust point(s).'
      end,
      'Someone vouched for you with ' || new.trust_points_transferred || ' trust point(s).'
    ),
    jsonb_build_object(
      'vouch_id', new.id,
      'voucher_id', new.voucher_id,
      'voucher_username', voucher_username,
      'trust_points_transferred', new.trust_points_transferred,
      'message', new.message
    )
  );
  
  return new;
end;
$$;

-- Trigger to create notification when vouch is received
drop trigger if exists on_user_vouch_created on public.user_vouches;
create trigger on_user_vouch_created
  after insert on public.user_vouches
  for each row
  execute function public.notify_vouch_received();

-- Function to check if user can apply for credit (has 5+ trust points)
create or replace function public.can_apply_for_credit(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_balance integer;
begin
  select balance into user_balance
  from public.trust_points
  where user_id = user_uuid;
  
  return coalesce(user_balance, 0) >= 5;
end;
$$;

