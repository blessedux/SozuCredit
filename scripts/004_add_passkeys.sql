-- Passkeys table for WebAuthn credentials
create table if not exists public.passkeys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint default 0,
  transports text[],
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.passkeys enable row level security;

-- Passkeys policies
create policy "Users can view their own passkeys"
  on public.passkeys for select
  using (auth.uid() = user_id);

create policy "Users can insert their own passkeys"
  on public.passkeys for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own passkeys"
  on public.passkeys for update
  using (auth.uid() = user_id);

create policy "Users can delete their own passkeys"
  on public.passkeys for delete
  using (auth.uid() = user_id);

-- Update profiles table to remove email requirement and add username
alter table public.profiles drop column if exists email;
alter table public.profiles add column if not exists username text unique not null;

-- Create index for faster username lookups
create index if not exists idx_profiles_username on public.profiles(username);
