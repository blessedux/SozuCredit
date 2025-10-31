-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Business ideas table
create table if not exists public.business_ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  funding_goal numeric(10, 2) not null,
  course_completed boolean default false,
  status text default 'pending' check (status in ('pending', 'approved', 'funded', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Vouches table (social proof)
create table if not exists public.vouches (
  id uuid primary key default uuid_generate_v4(),
  business_idea_id uuid not null references public.business_ideas(id) on delete cascade,
  voucher_id uuid not null references auth.users(id) on delete cascade,
  trust_points_spent integer default 1,
  message text,
  created_at timestamp with time zone default now(),
  unique(business_idea_id, voucher_id)
);

-- Trust points table
create table if not exists public.trust_points (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  balance integer default 5,
  last_daily_credit timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Vaults table (fund management)
create table if not exists public.vaults (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  balance numeric(10, 2) default 0,
  yield_rate numeric(5, 2) default 15.00,
  alias text unique,
  qr_code text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transactions table
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'yield', 'loan')),
  amount numeric(10, 2) not null,
  description text,
  created_at timestamp with time zone default now()
);

-- Course progress table
create table if not exists public.course_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id integer not null,
  completed boolean default false,
  created_at timestamp with time zone default now(),
  unique(user_id, lesson_id)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.business_ideas enable row level security;
alter table public.vouches enable row level security;
alter table public.trust_points enable row level security;
alter table public.vaults enable row level security;
alter table public.transactions enable row level security;
alter table public.course_progress enable row level security;

-- Profiles policies
create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Business ideas policies
create policy "Anyone can view approved business ideas"
  on public.business_ideas for select
  using (status = 'approved' or auth.uid() = user_id);

create policy "Users can insert their own business ideas"
  on public.business_ideas for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business ideas"
  on public.business_ideas for update
  using (auth.uid() = user_id);

-- Vouches policies
create policy "Anyone can view vouches"
  on public.vouches for select
  using (true);

create policy "Users can insert vouches"
  on public.vouches for insert
  with check (auth.uid() = voucher_id);

create policy "Users can delete their own vouches"
  on public.vouches for delete
  using (auth.uid() = voucher_id);

-- Trust points policies
create policy "Users can view their own trust points"
  on public.trust_points for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trust points"
  on public.trust_points for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trust points"
  on public.trust_points for update
  using (auth.uid() = user_id);

-- Vaults policies
create policy "Users can view their own vault"
  on public.vaults for select
  using (auth.uid() = user_id);

create policy "Users can insert their own vault"
  on public.vaults for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own vault"
  on public.vaults for update
  using (auth.uid() = user_id);

-- Transactions policies
create policy "Users can view their own transactions"
  on public.transactions for select
  using (auth.uid() = (select user_id from public.vaults where id = vault_id));

create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (auth.uid() = (select user_id from public.vaults where id = vault_id));

-- Course progress policies
create policy "Users can view their own course progress"
  on public.course_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own course progress"
  on public.course_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own course progress"
  on public.course_progress for update
  using (auth.uid() = user_id);
