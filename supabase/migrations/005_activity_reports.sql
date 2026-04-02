-- 営業日報（商談・訪問）と経費の紐付け（成果連動審査用）
-- ファイル名 005_activity_reports 相当（実行順はタイムスタンプ）

create table if not exists public.activity_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  report_date date not null,
  visit_count integer not null default 0,
  meeting_count integer not null default 0,
  proposal_count integer not null default 0,
  contract_count integer not null default 0,
  area text,
  client_names text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists activity_reports_company_employee_date_idx
  on public.activity_reports (company_id, employee_id, report_date desc);

alter table public.expenses
  add column if not exists activity_report_id uuid references public.activity_reports (id);

create index if not exists expenses_activity_report_id_idx
  on public.expenses (activity_report_id)
  where activity_report_id is not null;

alter table public.activity_reports enable row level security;

drop policy if exists "activity_reports_select" on public.activity_reports;
create policy "activity_reports_select"
  on public.activity_reports for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = activity_reports.company_id
          and p.role in ('approver', 'owner')
      )
    )
  );

drop policy if exists "activity_reports_insert_self" on public.activity_reports;
create policy "activity_reports_insert_self"
  on public.activity_reports for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "activity_reports_update_self" on public.activity_reports;
create policy "activity_reports_update_self"
  on public.activity_reports for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  )
  with check (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );

drop policy if exists "activity_reports_delete_self" on public.activity_reports;
create policy "activity_reports_delete_self"
  on public.activity_reports for delete to authenticated
  using (
    company_id = public.auth_user_company_id()
    and employee_id = auth.uid()
  );
