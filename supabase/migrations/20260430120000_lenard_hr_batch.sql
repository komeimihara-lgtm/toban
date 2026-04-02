-- 既存: profiles / incentive_* / employees / onboarding 作成後に実行
-- 含む: 商品マスタ(016相当) / 退職アラート(014) / AI面談(015) / HRドメイン / incentive.product_id

-- ========== products (016) ==========
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name text not null,
  cost_price numeric not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_company_name_key
  on public.products (company_id, name);

create index if not exists products_company_active_idx
  on public.products (company_id, is_active);

alter table public.products enable row level security;

drop policy if exists "products_read_all" on public.products;
create policy "products_read_all"
  on public.products for select to authenticated using (true);

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

insert into public.products (company_id, name, cost_price, is_active, notes)
values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'エイトキューブ', 75000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'バイマッハプロ', 1350000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'バイマッハ新品', 900000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'バイマッハミニ', 800000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'バイマッハミニMAX', 800000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'エルフィーノ', 800000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'バイマッハ中古', 700000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'マグニート', 750000, true, null),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'その他', 0, true, '手動入力')
on conflict (company_id, name) do nothing;

-- ========== profiles 拡張 ==========
alter table public.profiles
  add column if not exists department text,
  add column if not exists line_user_id text;

-- ========== employment_contracts ==========
create table if not exists public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade unique,
  company_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  base_salary numeric,
  deemed_overtime_hours numeric,
  deemed_overtime_pay numeric,
  commute_allowance numeric,
  commute_route text,
  hire_date date,
  probation_end_date date,
  next_paid_leave_date date,
  next_paid_leave_days numeric,
  updated_at timestamptz not null default now()
);

alter table public.employment_contracts enable row level security;

drop policy if exists "employment_self_read" on public.employment_contracts;
create policy "employment_self_read"
  on public.employment_contracts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "employment_admin_all" on public.employment_contracts;
create policy "employment_admin_all"
  on public.employment_contracts for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  )
  with check (true);

-- ========== expense_claims ==========
create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  category text not null,
  description text,
  status text not null default 'step1_pending'
    check (status in ('draft', 'step1_pending', 'approved', 'rejected')),
  reject_reason text,
  previous_claim_id uuid references public.expense_claims (id),
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_claims_user_idx
  on public.expense_claims (user_id, status);

alter table public.expense_claims enable row level security;

drop policy if exists "expense_own_all" on public.expense_claims;
create policy "expense_own_all"
  on public.expense_claims for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "expense_admin_select" on public.expense_claims;
create policy "expense_admin_select"
  on public.expense_claims for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "expense_admin_update" on public.expense_claims;
create policy "expense_admin_update"
  on public.expense_claims for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

-- ========== leave_requests ==========
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  kind text not null check (kind in ('full', 'half', 'hour')),
  reason text,
  status text not null default 'step1_pending'
    check (status in ('step1_pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_user_idx
  on public.leave_requests (user_id, status);

alter table public.leave_requests enable row level security;

drop policy if exists "leave_own_all" on public.leave_requests;
create policy "leave_own_all"
  on public.leave_requests for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "leave_admin_select" on public.leave_requests;
create policy "leave_admin_select"
  on public.leave_requests for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "leave_admin_update" on public.leave_requests;
create policy "leave_admin_update"
  on public.leave_requests for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

-- ========== paid_leave_balances ==========
create table if not exists public.paid_leave_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  days_remaining numeric not null default 0,
  days_used_ytd numeric not null default 0,
  next_accrual_date date,
  next_accrual_days numeric,
  updated_at timestamptz not null default now()
);

alter table public.paid_leave_balances enable row level security;

drop policy if exists "pl_balance_self" on public.paid_leave_balances;
create policy "pl_balance_self"
  on public.paid_leave_balances for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "pl_balance_admin" on public.paid_leave_balances;
create policy "pl_balance_admin"
  on public.paid_leave_balances for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  )
  with check (true);

-- ========== attendance_punches ==========
create table if not exists public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  punched_at timestamptz not null default now(),
  punch_type text not null check (punch_type in ('clock_in', 'clock_out')),
  source text default 'web'
);

create index if not exists attendance_punches_user_day_idx
  on public.attendance_punches (user_id, punched_at desc);

alter table public.attendance_punches enable row level security;

drop policy if exists "punch_own_insert" on public.attendance_punches;
create policy "punch_own_insert"
  on public.attendance_punches for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "punch_own_select" on public.attendance_punches;
create policy "punch_own_select"
  on public.attendance_punches for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "punch_admin_select" on public.attendance_punches;
create policy "punch_admin_select"
  on public.attendance_punches for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

-- ========== app_notifications ==========
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_user_idx
  on public.app_notifications (user_id, read_at, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "notif_own" on public.app_notifications;
create policy "notif_own"
  on public.app_notifications for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ========== auto_approval_rules ==========
create table if not exists public.auto_approval_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  rule_name text not null,
  max_amount numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.auto_approval_rules enable row level security;

drop policy if exists "auto_rules_admin" on public.auto_approval_rules;
create policy "auto_rules_admin"
  on public.auto_approval_rules for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (true);

-- ========== retention_alerts (014) ==========
create table if not exists public.retention_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('high', 'medium', 'low')),
  message text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_resolved boolean not null default false,
  resolved_by uuid references public.profiles (id)
);

create index if not exists retention_alerts_employee_idx
  on public.retention_alerts (employee_id, is_resolved, severity);

alter table public.retention_alerts enable row level security;

drop policy if exists "retention_alerts_admin_select" on public.retention_alerts;
create policy "retention_alerts_admin_select"
  on public.retention_alerts for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "retention_alerts_admin_modify" on public.retention_alerts;
create policy "retention_alerts_admin_modify"
  on public.retention_alerts for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  )
  with check (true);

-- ========== ai_interview_requests (015) ==========
create table if not exists public.ai_interview_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id),
  alert_id uuid references public.retention_alerts (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'completed', 'declined')),
  message text,
  summary text,
  risk_level text check (risk_level is null or risk_level in ('high', 'medium', 'low')),
  concern_areas jsonb default '[]'::jsonb,
  recommended_actions jsonb default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz
);

create index if not exists ai_interview_employee_status_idx
  on public.ai_interview_requests (employee_id, status);

alter table public.ai_interview_requests enable row level security;

drop policy if exists "ai_interview_employee_select" on public.ai_interview_requests;
create policy "ai_interview_employee_select"
  on public.ai_interview_requests for select to authenticated
  using (employee_id = auth.uid());

drop policy if exists "ai_interview_employee_update" on public.ai_interview_requests;
create policy "ai_interview_employee_update"
  on public.ai_interview_requests for update to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

drop policy if exists "ai_interview_admin_all" on public.ai_interview_requests;
create policy "ai_interview_admin_all"
  on public.ai_interview_requests for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'approver')
    )
  )
  with check (true);

-- ========== incentive product_id ==========
alter table public.incentive_submissions
  add column if not exists product_id uuid references public.products (id);
