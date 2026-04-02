-- 雇用契約拡張・有給付与履歴・通勤費
-- 既存 employment_contracts（user_id）を employee_id にリネームしカラムを拡張

-- ---------- employment_contracts: user_id -> employee_id ----------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employment_contracts'
      and column_name = 'user_id'
  )
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employment_contracts'
      and column_name = 'employee_id'
  ) then
    alter table public.employment_contracts rename column user_id to employee_id;
  end if;
end $$;

-- 旧カラム名のリネーム（存在時のみ）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employment_contracts'
      and column_name = 'deemed_overtime_pay'
  ) then
    alter table public.employment_contracts
      rename column deemed_overtime_pay to deemed_overtime_amount;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employment_contracts'
      and column_name = 'commute_allowance'
  ) then
    alter table public.employment_contracts
      rename column commute_allowance to commute_allowance_monthly;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employment_contracts'
      and column_name = 'probation_end_date'
  ) then
    alter table public.employment_contracts
      rename column probation_end_date to trial_end_date;
  end if;
end $$;

alter table public.employment_contracts
  add column if not exists employment_type text
    check (employment_type is null or employment_type in (
      'full_time', 'part_time', 'contract', 'dispatch'
    ));

alter table public.employment_contracts
  add column if not exists start_date date;

update public.employment_contracts
set start_date = coalesce(start_date, hire_date)
where start_date is null and hire_date is not null;

alter table public.employment_contracts
  add column if not exists hourly_wage numeric,
  add column if not exists work_hours_per_day numeric,
  add column if not exists work_days_per_week numeric,
  add column if not exists commute_distance_km numeric,
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

-- employee_id 一意制約
drop index if exists employment_contracts_user_id_key;
create unique index if not exists employment_contracts_employee_id_key
  on public.employment_contracts (employee_id);

-- RLS 再定義
drop policy if exists "employment_self_read" on public.employment_contracts;
drop policy if exists "employment_admin_all" on public.employment_contracts;
drop policy if exists "employment_contracts_select_self" on public.employment_contracts;
drop policy if exists "employment_contracts_admin_all" on public.employment_contracts;

create policy "employment_contracts_select_self"
  on public.employment_contracts for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

create policy "employment_contracts_admin_all"
  on public.employment_contracts for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employment_contracts.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- paid_leave_grants ----------
create table if not exists public.paid_leave_grants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  grant_date date not null,
  days_granted numeric not null,
  days_used numeric not null default 0,
  days_remaining numeric not null default 0,
  grant_reason text not null
    check (grant_reason in ('initial', 'anniversary', 'manual')),
  expires_at date,
  created_at timestamptz not null default now(),
  unique (employee_id, grant_date, grant_reason)
);

create index if not exists paid_leave_grants_employee_idx
  on public.paid_leave_grants (company_id, employee_id, grant_date desc);

alter table public.paid_leave_grants enable row level security;

drop policy if exists "paid_leave_grants_select_self" on public.paid_leave_grants;
create policy "paid_leave_grants_select_self"
  on public.paid_leave_grants for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "paid_leave_grants_admin_all" on public.paid_leave_grants;
create policy "paid_leave_grants_admin_all"
  on public.paid_leave_grants for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = paid_leave_grants.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- ---------- commute_expenses ----------
create table if not exists public.commute_expenses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  route_name text,
  from_station text,
  to_station text,
  transportation text not null default 'train'
    check (transportation in ('train', 'bus', 'car', 'bicycle', 'walk')),
  monthly_amount numeric not null default 0,
  ticket_type text not null default 'monthly'
    check (ticket_type in ('monthly', 'quarterly', 'annual')),
  valid_from date,
  valid_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists commute_expenses_employee_idx
  on public.commute_expenses (company_id, employee_id, is_active);

alter table public.commute_expenses enable row level security;

drop policy if exists "commute_expenses_select_self" on public.commute_expenses;
create policy "commute_expenses_select_self"
  on public.commute_expenses for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "commute_expenses_admin_all" on public.commute_expenses;
create policy "commute_expenses_admin_all"
  on public.commute_expenses for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = commute_expenses.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());
