-- レイアウトのインセンティブ表示は public.employees を参照する前提。
-- profiles と初期同期し、以降は API で両方更新する。

alter table public.employees
  add column if not exists is_sales_target boolean not null default false,
  add column if not exists is_service_target boolean not null default false;

update public.employees e
set
  is_sales_target = p.is_sales_target,
  is_service_target = p.is_service_target
from public.profiles p
where e.user_id = p.id;
