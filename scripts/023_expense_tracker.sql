-- Expense Tracker MVP (v0.2): categories, expenses, RLS

-- If expenses table already exists with reserved "date" column, rename to expense_date
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'date'
  ) then
    alter table public.expenses rename column "date" to expense_date;
  end if;
end $$;

-- Expense categories (system + user custom)
create table if not exists public.expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null,
  icon text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(slug, user_id)
);

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'CLP',
  merchant text,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  "expense_date" date not null default current_date,
  note text,
  source text not null default 'manual' check (source in ('manual', 'ocr', 'bank_sync')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(expense_date);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_expense_categories_user_id on public.expense_categories(user_id);

-- RLS
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

-- Categories: users can read system (user_id is null) and their own; insert/update/delete only their own
create policy "Users can view system and own categories"
  on public.expense_categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.expense_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.expense_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.expense_categories for delete
  using (auth.uid() = user_id);

-- Expenses: full CRUD for own rows
create policy "Users can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id);

create policy "Users can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- Seed system categories (user_id = null). Skip if already seeded.
insert into public.expense_categories (name, slug, icon)
select * from (values
  ('Groceries', 'groceries', 'ShoppingCart'),
  ('Dining', 'dining', 'UtensilsCrossed'),
  ('Transport', 'transport', 'Car'),
  ('Utilities', 'utilities', 'Zap'),
  ('Health', 'health', 'Heart'),
  ('Entertainment', 'entertainment', 'Film'),
  ('Shopping', 'shopping', 'ShoppingBag'),
  ('Subscriptions', 'subscriptions', 'Repeat'),
  ('Travel', 'travel', 'Plane'),
  ('Education', 'education', 'GraduationCap'),
  ('Personal', 'personal', 'User'),
  ('Other', 'other', 'Circle')
) as v(name, slug, icon)
where not exists (select 1 from public.expense_categories where user_id is null limit 1);
