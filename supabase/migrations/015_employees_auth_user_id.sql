-- employees と Supabase Auth ユーザーの明示的紐付け（初回セットアップ用）
alter table public.employees
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists employees_auth_user_id_uidx
  on public.employees (auth_user_id)
  where auth_user_id is not null;

comment on column public.employees.auth_user_id is 'auth.users.id（setup API で設定）。user_id(profiles) と通常一致';
