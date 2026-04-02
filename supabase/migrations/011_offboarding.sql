-- 退社手続き + employees 拡張

alter table public.employees
  add column if not exists resignation_date date;

alter table public.employees
  add column if not exists last_working_date date;

alter table public.employees
  add column if not exists offboarding_status text not null default 'active';

alter table public.employees drop constraint if exists employees_offboarding_status_check;
alter table public.employees
  add constraint employees_offboarding_status_check
  check (offboarding_status in ('active', 'resigned', 'offboarding', 'left'));

alter table public.employees
  add column if not exists scheduled_auth_deactivation_date date;

-- ---------- offboarding_tasks ----------
create table if not exists public.offboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_record_id uuid not null references public.employees (id) on delete cascade,
  task_type text not null
    check (task_type in (
      'resignation_letter', 'equipment_return', 'final_expense',
      'paid_leave_settlement', 'social_insurance', 'employment_certificate',
      'account_deactivation', 'farewell'
    )),
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists offboarding_tasks_emp_type_uidx
  on public.offboarding_tasks (employee_record_id, task_type);

create index if not exists offboarding_tasks_company_idx
  on public.offboarding_tasks (company_id, status);

alter table public.offboarding_tasks enable row level security;

drop policy if exists "offboarding_tasks_self" on public.offboarding_tasks;
create policy "offboarding_tasks_self"
  on public.offboarding_tasks for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.employees e
      where e.id = offboarding_tasks.employee_record_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.employees e
      where e.id = offboarding_tasks.employee_record_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "offboarding_tasks_admin" on public.offboarding_tasks;
create policy "offboarding_tasks_admin"
  on public.offboarding_tasks for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = offboarding_tasks.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());
