-- 打刻修正申請

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  target_date date not null,
  original_clock_in timestamptz,
  original_clock_out timestamptz,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_corrections_company_idx
  on public.attendance_corrections (company_id, status);
create index if not exists attendance_corrections_employee_idx
  on public.attendance_corrections (employee_id, target_date desc);

alter table public.attendance_corrections enable row level security;

drop policy if exists "att_corr_insert_own" on public.attendance_corrections;
create policy "att_corr_insert_own"
  on public.attendance_corrections for insert to authenticated
  with check (
    employee_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

drop policy if exists "att_corr_select" on public.attendance_corrections;
create policy "att_corr_select"
  on public.attendance_corrections for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and (
      employee_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.company_id = attendance_corrections.company_id
          and p.role in ('owner', 'approver')
      )
    )
  );

drop policy if exists "att_corr_update_admin" on public.attendance_corrections;
create policy "att_corr_update_admin"
  on public.attendance_corrections for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = attendance_corrections.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());
