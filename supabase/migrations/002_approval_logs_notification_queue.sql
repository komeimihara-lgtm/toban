-- =============================================================================
-- 002_approval_logs_notification_queue.sql
-- 承認履歴・LINE 等の通知キュー・入社オンボーディング（public.employees）
-- 前提: 001_initial.sql（profiles, companies）
-- =============================================================================

-- ---------- approval_logs ----------
create table if not exists public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  target_type text not null check (target_type in ('expense', 'incentive')),
  target_id uuid not null,
  action text not null check (action in ('step1_approve', 'step2_approve', 'reject')),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  actor_name text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists approval_logs_target_idx
  on public.approval_logs (target_type, target_id);

create index if not exists approval_logs_company_id_idx
  on public.approval_logs (company_id);

update public.approval_logs al
set company_id = coalesce(al.company_id, p.company_id)
from public.profiles p
where al.actor_id = p.id and al.company_id is null;

update public.approval_logs
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.approval_logs
  alter column company_id set not null;

-- ---------- notification_queue ----------
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  type text not null,
  recipient_line_id text,
  recipient_email text,
  message text not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists notification_queue_company_id_idx
  on public.notification_queue (company_id);

update public.notification_queue
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.notification_queue
  alter column company_id set default '00000000-0000-0000-0000-000000000001';

alter table public.notification_queue
  alter column company_id set not null;

-- ---------- employees（入社手続き・user_id = profiles.id） ----------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists employees_user_id_idx on public.employees (user_id);

update public.employees e
set company_id = coalesce(e.company_id, p.company_id)
from public.profiles p
where e.user_id = p.id and e.company_id is null;

update public.employees
set company_id = '00000000-0000-0000-0000-000000000001'
where company_id is null;

alter table public.employees
  alter column company_id set default '00000000-0000-0000-0000-000000000001';

alter table public.employees
  alter column company_id set not null;

-- ---------- onboarding_tasks ----------
create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  title text not null,
  completed boolean not null default false
);

create index if not exists onboarding_tasks_employee_id_idx
  on public.onboarding_tasks (employee_id);

-- ---------- RLS ----------
alter table public.approval_logs enable row level security;

drop policy if exists "approval_logs_admin_read" on public.approval_logs;
create policy "approval_logs_admin_read"
  on public.approval_logs for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('approver', 'owner')
    )
  );

drop policy if exists "approval_logs_insert" on public.approval_logs;
create policy "approval_logs_insert"
  on public.approval_logs for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and actor_id = auth.uid()
  );

alter table public.notification_queue enable row level security;
-- service_role 想定: authenticated には開けない

alter table public.employees enable row level security;

drop policy if exists "employees_self_all" on public.employees;
create policy "employees_self_all"
  on public.employees for all to authenticated
  using (user_id = auth.uid() and company_id = public.auth_user_company_id())
  with check (user_id = auth.uid() and company_id = public.auth_user_company_id());

alter table public.onboarding_tasks enable row level security;

drop policy if exists "onboarding_via_employee" on public.onboarding_tasks;
create policy "onboarding_via_employee"
  on public.onboarding_tasks for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = onboarding_tasks.employee_id
        and e.user_id = auth.uid()
        and e.company_id = public.auth_user_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.id = onboarding_tasks.employee_id
        and e.user_id = auth.uid()
        and e.company_id = public.auth_user_company_id()
    )
  );
