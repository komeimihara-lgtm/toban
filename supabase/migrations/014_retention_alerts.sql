-- 退職リスクアラート（離職防止分析用）
-- batch マイグレーションで未作成の環境向け。既存テーブルはスキップ。

create table if not exists public.retention_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  alert_type text not null,
  severity text not null
    check (severity in ('high', 'medium', 'low')),
  message text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_resolved boolean not null default false,
  resolved_by uuid references public.profiles (id)
);

create index if not exists retention_alerts_company_open_idx
  on public.retention_alerts (company_id, is_resolved, severity desc);

create index if not exists retention_alerts_employee_idx
  on public.retention_alerts (employee_id, is_resolved, severity);
