-- =============================================================================
-- 016_deals.sql — 案件ベースのインセンティブ（deals / deal_incentive_rates）
-- 注: 013 は 013_onboarding_documents_storage 済みのため 016 とした
-- =============================================================================

-- ---------- deal_incentive_rates ----------
create table if not exists public.deal_incentive_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  machine_type text not null,
  role text not null check (role in ('appo', 'closer', 'hito')),
  rate numeric not null check (rate >= 0 and rate <= 1),
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, machine_type, role)
);

create index if not exists idx_deal_incentive_rates_company
  on public.deal_incentive_rates (company_id);
create index if not exists idx_deal_incentive_rates_machine
  on public.deal_incentive_rates (company_id, machine_type);

-- ---------- deals ----------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  salon_name text not null default '',
  machine_type text not null default '',
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  payment_method text not null default '',
  payment_date date,
  net_profit numeric not null default 0,
  appo_employee_id uuid references public.profiles (id) on delete set null,
  closer_employee_id uuid references public.profiles (id) on delete set null,
  hito_employee_id uuid references public.profiles (id) on delete set null,
  hito_bottles int,
  appo_incentive numeric not null default 0,
  closer_incentive numeric not null default 0,
  hito_incentive numeric not null default 0,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'partial', 'paid')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deals_company_ym
  on public.deals (company_id, year, month);
create index if not exists idx_deals_company_appo
  on public.deals (company_id, appo_employee_id);
create index if not exists idx_deals_company_closer
  on public.deals (company_id, closer_employee_id);
create index if not exists idx_deals_company_hito
  on public.deals (company_id, hito_employee_id);

create or replace function public.set_deals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
  before update on public.deals
  for each row execute function public.set_deals_updated_at();

create or replace function public.set_deal_incentive_rates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_deal_incentive_rates_updated_at on public.deal_incentive_rates;
create trigger trg_deal_incentive_rates_updated_at
  before update on public.deal_incentive_rates
  for each row execute function public.set_deal_incentive_rates_updated_at();

-- ---------- deal_month_submissions（月次の提出記録） ----------
create table if not exists public.deal_month_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  unique (company_id, year, month)
);

create index if not exists idx_deal_month_submissions_company_ym
  on public.deal_month_submissions (company_id, year, month);

-- ---------- RLS ----------
alter table public.deal_incentive_rates enable row level security;
alter table public.deals enable row level security;
alter table public.deal_month_submissions enable row level security;

drop policy if exists "deal_incentive_rates_select_company" on public.deal_incentive_rates;
create policy "deal_incentive_rates_select_company"
  on public.deal_incentive_rates for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_incentive_rates.company_id
    )
  );

drop policy if exists "deal_incentive_rates_admin_all" on public.deal_incentive_rates;
create policy "deal_incentive_rates_admin_all"
  on public.deal_incentive_rates for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_incentive_rates.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_incentive_rates.company_id
        and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "deals_select" on public.deals;
create policy "deals_select"
  on public.deals for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and (
          p.role in ('owner', 'approver')
          or deals.appo_employee_id = p.id
          or deals.closer_employee_id = p.id
          or deals.hito_employee_id = p.id
        )
    )
  );

drop policy if exists "deals_admin_all" on public.deals;
create policy "deals_admin_all"
  on public.deals for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and p.role in ('owner', 'approver')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "deal_month_submissions_select" on public.deal_month_submissions;
create policy "deal_month_submissions_select"
  on public.deal_month_submissions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_month_submissions.company_id
        and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "deal_month_submissions_admin_insert" on public.deal_month_submissions;
create policy "deal_month_submissions_admin_insert"
  on public.deal_month_submissions for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_month_submissions.company_id
        and p.role in ('owner', 'approver')
    )
  );

drop policy if exists "deal_month_submissions_admin_update" on public.deal_month_submissions;
create policy "deal_month_submissions_admin_update"
  on public.deal_month_submissions for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deal_month_submissions.company_id
        and p.role in ('owner', 'approver')
    )
  );

-- ---------- Seed（既定会社） ----------
insert into public.deal_incentive_rates (company_id, machine_type, role, rate, is_default)
values
  ('00000000-0000-0000-0000-000000000001', 'エイトキューブ', 'appo', 0.05, true),
  ('00000000-0000-0000-0000-000000000001', 'エイトキューブ', 'closer', 0.05, true),
  ('00000000-0000-0000-0000-000000000001', 'エイトキューブ', 'hito', 0.08, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハプロ', 'appo', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハプロ', 'closer', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハプロ', 'hito', 0.08, true),
  ('00000000-0000-0000-0000-000000000001', 'エルフィーノ', 'appo', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'エルフィーノ', 'closer', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'エルフィーノ', 'hito', 0.08, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハ', 'appo', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハ', 'closer', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハ', 'hito', 0.08, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハミニMAX', 'appo', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハミニMAX', 'closer', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'バイマッハミニMAX', 'hito', 0.08, true)
on conflict (company_id, machine_type, role) do update set
  rate = excluded.rate,
  is_default = excluded.is_default,
  updated_at = now();
