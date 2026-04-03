-- =============================================================================
-- 019_deal_services.sql — 案件のサービス原価（JSONB）
-- hito_* 列は旧 017 で DROP 済みの DB 向けに if not exists で再作成可能にする
-- =============================================================================

alter table public.deals add column if not exists deal_services jsonb not null default '[]'::jsonb;

alter table public.deals add column if not exists hito_employee_id uuid references public.profiles (id) on delete set null;
alter table public.deals add column if not exists hito_bottles int;
alter table public.deals add column if not exists hito_incentive numeric not null default 0;

create index if not exists idx_deals_company_hito on public.deals (company_id, hito_employee_id);
