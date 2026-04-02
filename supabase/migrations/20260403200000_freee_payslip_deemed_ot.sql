-- freee 人事労務連携: トークン・みなし残業設定・実績キャッシュ・給与明細キャッシュ

alter table public.profiles
  add column if not exists freee_employee_id integer;

-- 会社単位でアクセストークン1行（管理／バックグラウンド用。RLS はアプリ側で SERVICE_ROLE のみ操作想定）
create table if not exists public.freee_tokens (
  id uuid primary key default gen_random_uuid(),
  freee_company_id text not null unique,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deemed_ot_settings (
  id uuid primary key default gen_random_uuid(),
  freee_company_id text not null,
  app_user_id uuid references public.profiles (id) on delete cascade,
  allotted_hours numeric(5, 2) not null default 30,
  monthly_amount integer not null default 60000,
  alert_pct integer not null default 80,
  excess_calc text not null default 'auto',
  effective_from date not null default (current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deemed_ot_settings_company_default_idx
  on public.deemed_ot_settings (freee_company_id)
  where app_user_id is null;

create unique index if not exists deemed_ot_settings_company_user_idx
  on public.deemed_ot_settings (freee_company_id, app_user_id)
  where app_user_id is not null;

create table if not exists public.deemed_ot_records (
  id uuid primary key default gen_random_uuid(),
  freee_company_id text not null,
  app_user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  month integer not null,
  overtime_hours numeric(6, 2),
  late_night_hours numeric(6, 2),
  holiday_work_hours numeric(6, 2),
  total_work_hours numeric(6, 2),
  allotted_hours numeric(5, 2),
  monthly_amount integer,
  excess_hours numeric(6, 2),
  excess_pay integer,
  consumption_pct integer,
  status text,
  freee_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (freee_company_id, app_user_id, year, month)
);

create index if not exists deemed_ot_records_user_ym_idx
  on public.deemed_ot_records (app_user_id, year desc, month desc);

create table if not exists public.payslip_cache (
  id uuid primary key default gen_random_uuid(),
  freee_company_id text not null,
  app_user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  month integer not null,
  pay_date date,
  base_salary integer,
  overtime_pay integer,
  commuting_fee integer,
  fixed_ot_pay integer,
  total_payment integer,
  health_ins integer,
  pension integer,
  employment_ins integer,
  income_tax integer,
  resident_tax integer,
  total_deduction integer,
  net_payment integer,
  raw_json jsonb,
  freee_stmt_id bigint,
  synced_at timestamptz not null default now(),
  unique (freee_company_id, app_user_id, year, month)
);

create index if not exists payslip_cache_user_ym_idx
  on public.payslip_cache (app_user_id, year desc, month desc);

alter table public.freee_tokens enable row level security;
alter table public.deemed_ot_settings enable row level security;
alter table public.deemed_ot_records enable row level security;
alter table public.payslip_cache enable row level security;
