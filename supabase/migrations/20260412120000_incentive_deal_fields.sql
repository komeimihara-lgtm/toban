-- 案件インセンティブ: 役割は appo（アポ）/ closer（クローザー）のみ
alter table public.incentive_submissions
  add column if not exists selling_price_tax_in numeric,
  add column if not exists actual_cost numeric,
  add column if not exists service_cost_deduction numeric default 0,
  add column if not exists deal_role text
    check (deal_role is null or deal_role in ('appo', 'closer')),
  add column if not exists net_profit_ex_tax numeric;

comment on column public.incentive_submissions.deal_role is
  '案件での役割: appo=アポ, closer=クローザー';
