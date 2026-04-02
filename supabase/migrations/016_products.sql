-- 商品マスタ（タスク0・原価）
-- 実行順: 016_deals.sql の後（辞書順で 014_auto < 014_retention < 015_ai < 015_employees < 016_deals < 016_products）

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001'::uuid,
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
  on public.products for select to authenticated
  using (company_id = public.auth_user_company_id());

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = products.company_id
        and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = products.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (company_id = public.auth_user_company_id());

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
