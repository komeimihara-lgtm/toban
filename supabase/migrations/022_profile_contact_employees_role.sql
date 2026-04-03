-- プロフィール連絡先・役職、employees.role（レイアウトの auth_user_id 照合用）

alter table public.profiles
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists emergency_contact text,
  add column if not exists job_title text;

alter table public.employees
  add column if not exists role text;

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees
  add constraint employees_role_check
  check (role is null or role in ('owner', 'approver', 'staff'));

update public.employees e
set role = p.role
from public.profiles p
where e.user_id = p.id;
