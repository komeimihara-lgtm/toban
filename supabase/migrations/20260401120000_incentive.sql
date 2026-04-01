-- アプリが参照するテーブル（RLS は環境に合わせて設定）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'staff'
    check (role in ('owner', 'approver', 'staff')),
  is_sales_target boolean not null default false,
  is_service_target boolean not null default false
);

create table if not exists public.incentive_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year_month text not null,
  rate numeric not null,
  formula_type text not null default 'fixed_rate',
  unique (user_id, year_month)
);

create table if not exists public.incentive_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year_month text not null,
  sales_amount numeric,
  rate_snapshot numeric,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  unique (user_id, year_month)
);

create index if not exists incentive_submissions_user_month_idx
  on public.incentive_submissions (user_id, year_month desc);
