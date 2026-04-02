-- =============================================================================
-- 003_multi_tenant.sql — マルチテナント（SaaS 前提）
-- レナード株式会社既定: id = 00000000-0000-0000-0000-000000000001
-- 前提: 001_initial.sql / 002_approval_logs_notification_queue.sql 適用済み
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

-- 既定テナント（手動指定 ID）
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
      'notes', 'インセンティブ対象部門は departments.incentive_enabled で制御'
    )
  )
)
on conflict (id) do update set
  name = excluded.name,
  plan = excluded.plan,
  settings = companies.settings || excluded.settings;

-- ---------- expense_categories（経費カテゴリ・会社ごと） ----------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists expense_categories_company_sort_idx
  on public.expense_categories (company_id, sort_order);

-- レナード: 既存 UI と同じラベル
insert into public.expense_categories (company_id, code, label, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'travel_local', '交通費', 10),
  ('00000000-0000-0000-0000-000000000001', 'entertainment', '接待交際費', 20),
  ('00000000-0000-0000-0000-000000000001', 'communications', '通信費', 30),
  ('00000000-0000-0000-0000-000000000001', 'supplies', '消耗品費', 40),
  ('00000000-0000-0000-0000-000000000001', 'training_books', '書籍・研修費', 50),
  ('00000000-0000-0000-0000-000000000001', 'advertising', '広告宣伝費', 60),
  ('00000000-0000-0000-0000-000000000001', 'trip_transport', '出張費（交通）', 70),
  ('00000000-0000-0000-0000-000000000001', 'trip_lodging', '出張費（宿泊）', 80),
  ('00000000-0000-0000-0000-000000000001', 'other', 'その他', 90)
on conflict (company_id, code) do nothing;

-- ---------- profiles.company_id ----------
alter table public.profiles
  add column if not exists company_id uuid references public.companies (id);

update public.profiles
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.profiles
  alter column company_id set default '00000000-0000-0000-0000-000000000001';

alter table public.profiles
  alter column company_id set not null;

create index if not exists profiles_company_id_idx on public.profiles (company_id);

-- ---------- テナント解決用（RLS 再帰回避） ----------
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

-- ---------- departments: company スコープへ ----------
alter table public.departments
  add column if not exists company_id uuid references public.companies (id);

update public.departments
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.departments
  alter column company_id set default '00000000-0000-0000-0000-000000000001';

alter table public.departments
  alter column company_id set not null;

alter table public.departments
  drop constraint if exists departments_name_key;

drop index if exists departments_name_key;

create unique index if not exists departments_company_name_key
  on public.departments (company_id, name);

create index if not exists departments_company_id_idx on public.departments (company_id);

-- ---------- expenses ----------
alter table public.expenses
  add column if not exists company_id uuid references public.companies (id);

update public.expenses e
set company_id = p.company_id
from public.profiles p
where e.submitter_id = p.id and e.company_id is null;

alter table public.expenses
  alter column company_id set not null;

create index if not exists expenses_company_id_idx on public.expenses (company_id);

-- ---------- incentive_configs ----------
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.incentive_configs'::regclass
      and con.contype = 'u'
  loop
    execute format('alter table public.incentive_configs drop constraint %I', cname);
  end loop;
end $$;

alter table public.incentive_configs
  add column if not exists company_id uuid references public.companies (id);

update public.incentive_configs ic
set company_id = p.company_id
from public.profiles p
where ic.employee_id = p.id and ic.company_id is null;

alter table public.incentive_configs
  alter column company_id set not null;

create unique index if not exists incentive_configs_company_period_emp_dept_key
  on public.incentive_configs (company_id, year, month, department_id, employee_id);

create index if not exists incentive_configs_company_id_idx
  on public.incentive_configs (company_id);

-- ---------- incentive_rates ----------
alter table public.incentive_rates
  drop constraint if exists incentive_rates_user_id_year_month_key;

alter table public.incentive_rates
  add column if not exists company_id uuid references public.companies (id);

update public.incentive_rates ir
set company_id = p.company_id
from public.profiles p
where ir.user_id = p.id and ir.company_id is null;

alter table public.incentive_rates
  alter column company_id set not null;

create unique index if not exists incentive_rates_company_user_ym_key
  on public.incentive_rates (company_id, user_id, year_month);

create index if not exists incentive_rates_company_id_idx on public.incentive_rates (company_id);

-- ---------- incentive_submissions ----------
alter table public.incentive_submissions
  drop constraint if exists incentive_submissions_user_id_year_month_key;

alter table public.incentive_submissions
  add column if not exists company_id uuid references public.companies (id);

update public.incentive_submissions s
set company_id = p.company_id
from public.profiles p
where s.user_id = p.id and s.company_id is null;

alter table public.incentive_submissions
  alter column company_id set not null;

create unique index if not exists incentive_submissions_company_user_ym_key
  on public.incentive_submissions (company_id, user_id, year_month);

-- ---------- approval_logs ----------
alter table public.approval_logs
  add column if not exists company_id uuid references public.companies (id);

update public.approval_logs al
set company_id = p.company_id
from public.profiles p
where al.actor_id = p.id and al.company_id is null;

alter table public.approval_logs
  alter column company_id set not null;

create index if not exists approval_logs_company_id_idx on public.approval_logs (company_id);

-- ---------- notification_queue ----------
alter table public.notification_queue
  add column if not exists company_id uuid references public.companies (id);

alter table public.notification_queue
  add column if not exists recipient_email text;

update public.notification_queue
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.notification_queue
  alter column company_id set not null;

create index if not exists notification_queue_company_id_idx
  on public.notification_queue (company_id);

-- ---------- expense_claims ----------
alter table public.expense_claims
  add column if not exists company_id uuid references public.companies (id);

update public.expense_claims ec
set company_id = p.company_id
from public.profiles p
where ec.user_id = p.id and ec.company_id is null;

alter table public.expense_claims
  alter column company_id set not null;

create index if not exists expense_claims_company_id_idx
  on public.expense_claims (company_id);

-- ---------- leave_requests ----------
alter table public.leave_requests
  add column if not exists company_id uuid references public.companies (id);

update public.leave_requests lr
set company_id = p.company_id
from public.profiles p
where lr.user_id = p.id and lr.company_id is null;

alter table public.leave_requests
  alter column company_id set not null;

create index if not exists leave_requests_company_id_idx on public.leave_requests (company_id);

-- ---------- paid_leave_balances ----------
alter table public.paid_leave_balances
  add column if not exists company_id uuid references public.companies (id);

update public.paid_leave_balances pl
set company_id = p.company_id
from public.profiles p
where pl.user_id = p.id and pl.company_id is null;

alter table public.paid_leave_balances
  alter column company_id set not null;

-- ---------- attendance_punches ----------
alter table public.attendance_punches
  add column if not exists company_id uuid references public.companies (id);

update public.attendance_punches ap
set company_id = p.company_id
from public.profiles p
where ap.user_id = p.id and ap.company_id is null;

alter table public.attendance_punches
  alter column company_id set not null;

create index if not exists attendance_punches_company_id_idx
  on public.attendance_punches (company_id);

-- ---------- app_notifications ----------
alter table public.app_notifications
  add column if not exists company_id uuid references public.companies (id);

update public.app_notifications an
set company_id = p.company_id
from public.profiles p
where an.user_id = p.id and an.company_id is null;

alter table public.app_notifications
  alter column company_id set not null;

-- ---------- employees (onboarding) ----------
alter table public.employees
  add column if not exists company_id uuid references public.companies (id);

update public.employees e
set company_id = p.company_id
from public.profiles p
where e.user_id = p.id and e.company_id is null;

alter table public.employees
  alter column company_id set not null;

-- ---------- freee 系（テナント紐付け用・既存 freee_company_id は維持） ----------
alter table public.freee_tokens
  add column if not exists company_id uuid references public.companies (id);

update public.freee_tokens
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.deemed_ot_settings
  add column if not exists company_id uuid references public.companies (id);

update public.deemed_ot_settings
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.deemed_ot_records
  add column if not exists company_id uuid references public.companies (id);

update public.deemed_ot_records r
set company_id = p.company_id
from public.profiles p
where r.app_user_id = p.id and r.company_id is null;

alter table public.payslip_cache
  add column if not exists company_id uuid references public.companies (id);

update public.payslip_cache c
set company_id = p.company_id
from public.profiles p
where c.app_user_id = p.id and c.company_id is null;

-- =============================================================================
-- RLS: companies & expense_categories
-- =============================================================================
alter table public.companies enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
  on public.companies for select to authenticated
  using (id = public.auth_user_company_id());

drop policy if exists "companies_update_owner" on public.companies;
create policy "companies_update_owner"
  on public.companies for update to authenticated
  using (
    id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (id = public.auth_user_company_id());

alter table public.expense_categories enable row level security;

drop policy if exists "expense_categories_select" on public.expense_categories;
create policy "expense_categories_select"
  on public.expense_categories for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "expense_categories_write_owner" on public.expense_categories;
create policy "expense_categories_write_owner"
  on public.expense_categories for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: profiles（テナント分離）
-- =============================================================================
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

-- =============================================================================
-- RLS: departments（再定義）
-- =============================================================================
drop policy if exists "departments_read_authenticated" on public.departments;
create policy "departments_read_authenticated"
  on public.departments for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "departments_write_owner" on public.departments;
create policy "departments_write_owner"
  on public.departments for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: expenses（再定義）
-- =============================================================================
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
        where p.id = auth.uid()
          and p.company_id = expenses.company_id
          and p.role in ('approver', 'owner')
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
        where p.id = auth.uid()
          and p.company_id = expenses.company_id
          and p.role in ('approver', 'owner')
      )
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: incentive_configs（再定義）
-- =============================================================================
drop policy if exists "incentive_configs_select" on public.incentive_configs;
create policy "incentive_configs_select"
  on public.incentive_configs for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = incentive_configs.company_id
          and p.role in ('approver', 'owner')
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
        where p.id = auth.uid()
          and p.company_id = incentive_configs.company_id
          and p.role in ('approver', 'owner')
      )
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: incentive_rates / incentive_submissions（テナント）
-- =============================================================================
alter table public.incentive_rates enable row level security;

drop policy if exists "incentive_rates_select" on public.incentive_rates;
drop policy if exists "incentive_rates_mutate_admin" on public.incentive_rates;

create policy "incentive_rates_select"
  on public.incentive_rates for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = incentive_rates.company_id
          and p.role in ('approver', 'owner')
      )
    )
  );

create policy "incentive_rates_mutate_admin"
  on public.incentive_rates for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = incentive_rates.company_id
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

alter table public.incentive_submissions enable row level security;

drop policy if exists "incentive_submissions_own" on public.incentive_submissions;

create policy "incentive_submissions_select"
  on public.incentive_submissions for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = incentive_submissions.company_id
          and p.role in ('approver', 'owner')
      )
    )
  );

create policy "incentive_submissions_mutate_self"
  on public.incentive_submissions for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

create policy "incentive_submissions_update_self"
  on public.incentive_submissions for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  )
  with check (company_id = public.auth_user_company_id());

create policy "incentive_submissions_admin_update"
  on public.incentive_submissions for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: approval_logs（再定義）
-- =============================================================================
drop policy if exists "approval_logs_admin_read" on public.approval_logs;
create policy "approval_logs_admin_read"
  on public.approval_logs for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = approval_logs.company_id
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "approval_logs_insert" on public.approval_logs;
create policy "approval_logs_insert"
  on public.approval_logs for insert to authenticated
  with check (
    actor_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

-- =============================================================================
-- RLS: products（再定義）
-- =============================================================================
drop policy if exists "products_read_all" on public.products;
create policy "products_read_all"
  on public.products for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = products.company_id
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = products.company_id
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- =============================================================================
-- RLS: employment_contracts, expense_claims, leave_requests, etc.
-- =============================================================================
drop policy if exists "employment_self_read" on public.employment_contracts;
create policy "employment_self_read"
  on public.employment_contracts for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "employment_admin_all" on public.employment_contracts;
create policy "employment_admin_all"
  on public.employment_contracts for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employment_contracts.company_id
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "expense_own_all" on public.expense_claims;
create policy "expense_own_all"
  on public.expense_claims for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  )
  with check (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "expense_admin_select" on public.expense_claims;
create policy "expense_admin_select"
  on public.expense_claims for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = expense_claims.company_id
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "expense_admin_update" on public.expense_claims;
create policy "expense_admin_update"
  on public.expense_claims for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = expense_claims.company_id
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "leave_own_all" on public.leave_requests;
create policy "leave_own_all"
  on public.leave_requests for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  )
  with check (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "leave_admin_select" on public.leave_requests;
create policy "leave_admin_select"
  on public.leave_requests for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = leave_requests.company_id
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "leave_admin_update" on public.leave_requests;
create policy "leave_admin_update"
  on public.leave_requests for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = leave_requests.company_id
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "pl_balance_self" on public.paid_leave_balances;
create policy "pl_balance_self"
  on public.paid_leave_balances for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "pl_balance_admin" on public.paid_leave_balances;
create policy "pl_balance_admin"
  on public.paid_leave_balances for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "punch_own_insert" on public.attendance_punches;
create policy "punch_own_insert"
  on public.attendance_punches for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "punch_own_select" on public.attendance_punches;
create policy "punch_own_select"
  on public.attendance_punches for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "punch_admin_select" on public.attendance_punches;
create policy "punch_admin_select"
  on public.attendance_punches for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "notif_own" on public.app_notifications;
create policy "notif_own"
  on public.app_notifications for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  )
  with check (
    company_id = public.auth_user_company_id()
    and user_id = auth.uid()
  );

drop policy if exists "auto_rules_admin" on public.auto_approval_rules;
create policy "auto_rules_admin"
  on public.auto_approval_rules for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "retention_alerts_admin_select" on public.retention_alerts;
create policy "retention_alerts_admin_select"
  on public.retention_alerts for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "retention_alerts_admin_modify" on public.retention_alerts;
create policy "retention_alerts_admin_modify"
  on public.retention_alerts for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "ai_interview_employee_select" on public.ai_interview_requests;
create policy "ai_interview_employee_select"
  on public.ai_interview_requests for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "ai_interview_employee_update" on public.ai_interview_requests;
create policy "ai_interview_employee_update"
  on public.ai_interview_requests for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  )
  with check (company_id = public.auth_user_company_id());

drop policy if exists "ai_interview_admin_all" on public.ai_interview_requests;
create policy "ai_interview_admin_all"
  on public.ai_interview_requests for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('approver', 'owner')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- departments seed をテナント対応で再投入（同名他社を許容）
insert into public.departments (company_id, name, incentive_enabled, incentive_formula_type)
values
  ('00000000-0000-0000-0000-000000000001', '営業部', true, 'fixed_rate'),
  ('00000000-0000-0000-0000-000000000001', 'サービス部', true, 'fixed_rate'),
  ('00000000-0000-0000-0000-000000000001', '管理本部', false, 'fixed_rate'),
  ('00000000-0000-0000-0000-000000000001', '名古屋支社', false, 'fixed_rate')
on conflict (company_id, name) do update set
  incentive_enabled = excluded.incentive_enabled,
  incentive_formula_type = excluded.incentive_formula_type;
