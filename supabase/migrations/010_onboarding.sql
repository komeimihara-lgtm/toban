-- 入社オンボーディング拡張（既存 onboarding_tasks を拡張）+ onboarding_documents

alter table public.onboarding_tasks
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

update public.onboarding_tasks ot
set company_id = e.company_id
from public.employees e
where e.id = ot.employee_id and ot.company_id is null;

update public.onboarding_tasks
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.onboarding_tasks
  alter column company_id set not null;

alter table public.onboarding_tasks
  add column if not exists task_type text;

alter table public.onboarding_tasks
  add column if not exists description text;

alter table public.onboarding_tasks
  add column if not exists status text not null default 'pending';

alter table public.onboarding_tasks
  add column if not exists due_date date;

alter table public.onboarding_tasks
  add column if not exists completed_at timestamptz;

update public.onboarding_tasks
set status = case when completed then 'completed' else 'pending' end
where status = 'pending' and completed is not null;

alter table public.onboarding_tasks drop constraint if exists onboarding_tasks_task_type_check;
alter table public.onboarding_tasks
  add constraint onboarding_tasks_task_type_check
  check (
    task_type is null or task_type in (
      'contract', 'my_number', 'bank_account', 'commute_route',
      'emergency_contact', 'health_insurance', 'pension', 'equipment'
    )
  );

alter table public.onboarding_tasks drop constraint if exists onboarding_tasks_status_check;
alter table public.onboarding_tasks
  add constraint onboarding_tasks_status_check
  check (status in ('pending', 'completed', 'skipped'));

create unique index if not exists onboarding_tasks_employee_task_type_key
  on public.onboarding_tasks (employee_id, task_type)
  where task_type is not null;

-- ---------- onboarding_documents ----------
create table if not exists public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.onboarding_tasks (id) on delete set null,
  document_type text,
  file_url text not null,
  file_name text,
  uploaded_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz
);

create index if not exists onboarding_documents_employee_idx
  on public.onboarding_documents (company_id, employee_id);

alter table public.onboarding_documents enable row level security;

drop policy if exists "onboarding_docs_select" on public.onboarding_documents;
create policy "onboarding_docs_select"
  on public.onboarding_documents for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = onboarding_documents.company_id
          and p.role in ('owner', 'approver')
      )
    )
  );

drop policy if exists "onboarding_docs_insert_own" on public.onboarding_documents;
create policy "onboarding_docs_insert_own"
  on public.onboarding_documents for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "onboarding_docs_update_admin" on public.onboarding_documents;
create policy "onboarding_docs_update_admin"
  on public.onboarding_documents for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = onboarding_documents.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());

-- employees: 管理者がテナント内一覧参照
drop policy if exists "employees_admin_select" on public.employees;
create policy "employees_admin_select"
  on public.employees for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employees.company_id
        and p.role in ('owner', 'approver')
    )
  );

-- onboarding_tasks: 管理者はテナント内すべて
drop policy if exists "onboarding_via_employee" on public.onboarding_tasks;
drop policy if exists "onboarding_tasks_self" on public.onboarding_tasks;
drop policy if exists "onboarding_tasks_admin" on public.onboarding_tasks;

create policy "onboarding_tasks_self"
  on public.onboarding_tasks for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.employees e
      where e.id = onboarding_tasks.employee_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.employees e
      where e.id = onboarding_tasks.employee_id
        and e.user_id = auth.uid()
    )
  );

create policy "onboarding_tasks_admin_all"
  on public.onboarding_tasks for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = onboarding_tasks.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());
