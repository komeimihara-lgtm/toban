-- サイドバー「入社手続き」表示判定用（RLS は環境に合わせて設定）
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists employees_user_id_idx on public.employees (user_id);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  title text not null,
  completed boolean not null default false
);

create index if not exists onboarding_tasks_employee_id_idx
  on public.onboarding_tasks (employee_id);
