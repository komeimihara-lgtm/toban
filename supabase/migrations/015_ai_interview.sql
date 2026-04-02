-- AI面談リクエスト（タスク14）
-- batch で既に存在する場合はスキップ。新規環境向けの定義を揃える。

create table if not exists public.ai_interview_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id),
  alert_id uuid references public.retention_alerts (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'completed', 'declined')),
  message text,
  summary text,
  risk_level text
    check (risk_level is null or risk_level in ('high', 'medium', 'low')),
  concern_areas jsonb default '[]'::jsonb,
  recommended_actions jsonb default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz
);

create index if not exists ai_interview_employee_status_idx
  on public.ai_interview_requests (employee_id, status);
