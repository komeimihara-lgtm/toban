-- =============================================================================
-- 001_initial.sql — LENARD HR 初期スキーマ（CLAUDE.md 組織・レナード株式会社）
--
-- 含む: companies, departments, profiles, expenses, incentive_configs,
--       incentive_rates, incentive_submissions, hr_employees（17名シード）
-- RLS: staff / approver / owner（経費・インセンティブ設定の基本形）。
-- マルチテナント用の詳細RLS・expense_categories は 003_multi_tenant.sql。
--
-- 注: profiles.id は auth.users と1:1。シードの17名は hr_employees に保持し、
--     ログイン用 profiles は Auth 作成後に紐付けます。
-- =============================================================================

-- ---------- companies ----------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.companies (id, name, plan, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'レナード株式会社',
  'pro',
  jsonb_build_object(
    'approval', jsonb_build_object(
      'flow', 'two_step',
      'steps', jsonb_build_array(
        jsonb_build_object(
          'order', 1,
          'approver_role', 'approver',
          'label', '第1承認'
        ),
        jsonb_build_object(
          'order', 2,
          'approver_role', 'owner',
          'label', '最終承認'
        )
      )
    ),
    'notification', jsonb_build_object(
      'channels', jsonb_build_array('line')
    ),
    'incentive', jsonb_build_object(
      'use_department_incentive_flag', true,
      'notes', '対象部門は departments.incentive_enabled で制御'
    )
  )
)
on conflict (id) do update set
  name = excluded.name,
  plan = excluded.plan,
  settings = companies.settings || excluded.settings;

-- ---------- departments（営業部・サービス部・管理本部・名古屋支社） ----------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  incentive_enabled boolean not null default false,
  incentive_formula_type text not null default 'fixed_rate'
    check (incentive_formula_type in ('fixed_rate', 'tiered', 'above_target')),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists departments_company_id_idx
  on public.departments (company_id);

insert into public.departments (id, company_id, name, incentive_enabled, incentive_formula_type)
values
  (
    'a1111111-1111-4111-8111-111111111101',
    '00000000-0000-0000-0000-000000000001',
    '管理本部',
    false,
    'fixed_rate'
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    '00000000-0000-0000-0000-000000000001',
    'サービス部',
    true,
    'fixed_rate'
  ),
  (
    'a1111111-1111-4111-8111-111111111103',
    '00000000-0000-0000-0000-000000000001',
    '営業部',
    true,
    'fixed_rate'
  ),
  (
    'a1111111-1111-4111-8111-111111111104',
    '00000000-0000-0000-0000-000000000001',
    '名古屋支社',
    false,
    'fixed_rate'
  )
on conflict (company_id, name) do update set
  incentive_enabled = excluded.incentive_enabled,
  incentive_formula_type = excluded.incentive_formula_type;

-- ---------- profiles（ログインユーザー） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'staff'
    check (role in ('owner', 'approver', 'staff')),
  is_sales_target boolean not null default false,
  is_service_target boolean not null default false,
  company_id uuid references public.companies (id),
  department_id uuid references public.departments (id),
  is_contract boolean not null default false,
  is_part_time boolean not null default false,
  line_user_id text
);

update public.profiles
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.profiles
  alter column company_id set default '00000000-0000-0000-0000-000000000001';

alter table public.profiles
  alter column company_id set not null;

create index if not exists profiles_company_id_idx on public.profiles (company_id);
create index if not exists profiles_department_id_idx on public.profiles (department_id);

-- ---------- テナント解決（RLS 用） ----------
create or replace function public.auth_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

grant execute on function public.auth_user_company_id() to authenticated;

-- ---------- RLS: profiles ----------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or company_id = public.auth_user_company_id()
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and company_id is not null
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- RLS: companies（自テナントのみ参照） ----------
alter table public.companies enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
  on public.companies for select to authenticated
  using (id = public.auth_user_company_id());

drop policy if exists "companies_write_owner" on public.companies;
create policy "companies_write_owner"
  on public.companies for update to authenticated
  using (
    id = public.auth_user_company_id()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  )
  with check (id = public.auth_user_company_id());

-- ---------- incentive_rates ----------
create table if not exists public.incentive_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  user_id uuid not null references public.profiles (id) on delete cascade,
  year_month text not null,
  rate numeric not null,
  formula_type text not null default 'fixed_rate',
  unique (company_id, user_id, year_month)
);

create index if not exists incentive_rates_company_id_idx
  on public.incentive_rates (company_id);

-- ---------- incentive_submissions ----------
create table if not exists public.incentive_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  user_id uuid not null references public.profiles (id) on delete cascade,
  year_month text not null,
  sales_amount numeric,
  rate_snapshot numeric,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  selling_price_tax_in numeric,
  actual_cost numeric,
  service_cost_deduction numeric default 0,
  deal_role text
    check (deal_role is null or deal_role in ('appo', 'closer')),
  net_profit_ex_tax numeric,
  unique (company_id, user_id, year_month)
);

create index if not exists incentive_submissions_user_month_idx
  on public.incentive_submissions (user_id, year_month desc);

-- ---------- expenses（2段階承認・AI審査列込み） ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  type text not null
    check (type in ('expense', 'travel', 'advance', 'advance_settle')),
  status text not null default 'draft'
    check (status in ('draft', 'step1_pending', 'step2_pending', 'approved', 'rejected')),
  submitter_id uuid not null references public.profiles (id) on delete cascade,
  submitter_name text,
  department_id uuid references public.departments (id),
  category text not null,
  amount numeric not null,
  paid_date date not null,
  vendor text not null default '',
  purpose text not null,
  attendees text,
  from_location text,
  to_location text,
  receipt_url text,
  receipt_ocr_data jsonb,
  rejection_reason text,
  rejected_by_id uuid references public.profiles (id),
  step1_approved_by uuid references public.profiles (id),
  step1_approved_at timestamptz,
  step2_approved_by uuid references public.profiles (id),
  step2_approved_at timestamptz,
  audit_result jsonb,
  audit_at timestamptz,
  audit_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_submitter_idx on public.expenses (submitter_id, status);
create index if not exists expenses_status_idx on public.expenses (status);
create index if not exists expenses_paid_date_idx on public.expenses (paid_date);
create index if not exists expenses_company_id_idx on public.expenses (company_id);

comment on column public.expenses.audit_result is 'AI審査レスポンス（verdict, issues 等）';
comment on column public.expenses.audit_at is '最終審査実行時刻';
comment on column public.expenses.audit_score is '妥当性スコア 0-100';

-- ---------- incentive_configs ----------
create table if not exists public.incentive_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  department_id uuid not null references public.departments (id) on delete restrict,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  employee_name text,
  sales_amount numeric not null default 0,
  rate numeric not null default 0,
  incentive_amount numeric not null default 0,
  formula_type text not null default 'fixed_rate'
    check (formula_type in ('fixed_rate', 'tiered', 'above_target')),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'step1_approved', 'final_approved', 'paid')),
  notes text,
  freee_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year, month, department_id, employee_id)
);

create index if not exists incentive_configs_period_idx
  on public.incentive_configs (year, month, department_id);

create index if not exists incentive_configs_company_id_idx
  on public.incentive_configs (company_id);

-- ---------- hr_employees（CLAUDE.md 17名・auth 非連携の人事マスタ行）
-- 依頼仕様の「employees テーブル」に相当。入社オンボ用 public.employees は 002 で定義。
-- ----------
create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  department_id uuid references public.departments (id),
  full_name text not null,
  app_role text not null default 'staff'
    check (app_role in ('owner', 'approver', 'staff')),
  is_sales_target boolean not null default false,
  is_service_target boolean not null default false,
  is_contract boolean not null default false,
  is_part_time boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, full_name)
);

create index if not exists hr_employees_company_idx on public.hr_employees (company_id);

insert into public.hr_employees (
  id, company_id, department_id, full_name, app_role,
  is_sales_target, is_service_target, is_contract, is_part_time
) values
  ('b2000001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111101', '三原孔明', 'owner', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111101', '千葉', 'approver', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111101', '松田', 'staff', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '高橋', 'staff', false, true, false, false),
  ('b2000001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '田村', 'staff', false, true, false, false),
  ('b2000001-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '橋本', 'staff', false, true, false, false),
  ('b2000001-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '中村', 'staff', false, true, false, false),
  ('b2000001-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '小山', 'staff', false, false, false, true),
  ('b2000001-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111102', '吉田', 'staff', false, false, false, true),
  ('b2000001-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111103', '川津', 'staff', true, false, false, false),
  ('b2000001-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111101', '後藤', 'staff', false, false, true, false),
  ('b2000001-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111104', '五島', 'staff', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111104', '藤野', 'staff', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111104', '稲垣', 'staff', false, false, false, false),
  ('b2000001-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111103', '大岩', 'staff', true, false, false, false),
  ('b2000001-0000-4000-8000-000000000016', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111103', '小笠原', 'staff', true, false, false, false),
  ('b2000001-0000-4000-8000-000000000017', '00000000-0000-0000-0000-000000000001', 'a1111111-1111-4111-8111-111111111103', '飯田', 'staff', true, false, false, false)
on conflict (id) do nothing;

-- ---------- RLS: departments ----------
alter table public.departments enable row level security;

drop policy if exists "departments_read_authenticated" on public.departments;
create policy "departments_read_authenticated"
  on public.departments for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "departments_write_owner" on public.departments;
create policy "departments_write_owner"
  on public.departments for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- RLS: expenses（staff=自分 / approver・owner=全件） ----------
alter table public.expenses enable row level security;

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own"
  on public.expenses for insert to authenticated
  with check (
    submitter_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

drop policy if exists "expenses_select_visible" on public.expenses;
create policy "expenses_select_visible"
  on public.expenses for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      submitter_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('approver', 'owner')
      )
    )
  );

drop policy if exists "expenses_update_mutable" on public.expenses;
create policy "expenses_update_mutable"
  on public.expenses for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      submitter_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('approver', 'owner')
      )
    )
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- RLS: incentive_configs ----------
alter table public.incentive_configs enable row level security;

drop policy if exists "incentive_configs_select" on public.incentive_configs;
create policy "incentive_configs_select"
  on public.incentive_configs for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('approver', 'owner')
      )
    )
  );

drop policy if exists "incentive_configs_mutate" on public.incentive_configs;
create policy "incentive_configs_mutate"
  on public.incentive_configs for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('approver', 'owner')
      )
    )
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- RLS: hr_employees（テナント内参照・owner のみ更新想定） ----------
alter table public.hr_employees enable row level security;

drop policy if exists "hr_employees_select_tenant" on public.hr_employees;
create policy "hr_employees_select_tenant"
  on public.hr_employees for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "hr_employees_write_owner" on public.hr_employees;
create policy "hr_employees_write_owner"
  on public.hr_employees for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  )
  with check (company_id = public.auth_user_company_id());
