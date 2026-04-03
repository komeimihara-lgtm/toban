-- =============================================================================
-- 017_deals_workflow.sql — 案件インセンティブ: 提出・承認フロー / ヒト幹撤去
-- （013 は onboarding で使用中のため 017）
-- =============================================================================

-- ---------- approval_logs: deal 対応 ----------
alter table public.approval_logs drop constraint if exists approval_logs_target_type_check;
alter table public.approval_logs
  add constraint approval_logs_target_type_check
  check (target_type in ('expense', 'incentive', 'deal'));

alter table public.approval_logs drop constraint if exists approval_logs_action_check;
alter table public.approval_logs
  add constraint approval_logs_action_check
  check (
    action in (
      'step1_approve', 'step2_approve', 'reject', 'ai_auto_approve',
      'deal_approve', 'deal_reject'
    )
  );

-- ---------- deal_incentive_rates: hito 削除 ----------
delete from public.deal_incentive_rates where role = 'hito';

alter table public.deal_incentive_rates drop constraint if exists deal_incentive_rates_role_check;
alter table public.deal_incentive_rates
  add constraint deal_incentive_rates_role_check
  check (role in ('appo', 'closer'));

-- ---------- deals: 列変更 ----------
alter table public.deals drop constraint if exists deals_machine_type_check;

-- hito_* 列はデータ保全のため保持（アプリの UI ・計算からは除外）
alter table public.deals drop column if exists created_by;

alter table public.deals add column if not exists submit_status text;
alter table public.deals add column if not exists submitted_by uuid references public.profiles (id) on delete set null;
alter table public.deals add column if not exists approved_by uuid references public.profiles (id) on delete set null;
alter table public.deals add column if not exists reject_reason text;

update public.deals set submit_status = coalesce(nullif(trim(submit_status), ''), 'draft') where submit_status is null;

alter table public.deals alter column submit_status set default 'draft';
alter table public.deals alter column submit_status set not null;

alter table public.deals drop constraint if exists deals_submit_status_check;
alter table public.deals
  add constraint deals_submit_status_check
  check (submit_status in ('draft', 'submitted', 'approved', 'rejected'));

-- ---------- RLS 再定義 ----------
drop policy if exists "deals_select" on public.deals;
drop policy if exists "deals_admin_all" on public.deals;

create policy "deals_select" on public.deals for select using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = deals.company_id
      and (
        p.role in ('owner', 'approver')
        or deals.appo_employee_id = p.id
        or deals.closer_employee_id = p.id
      )
  )
);

create policy "deals_admin_all" on public.deals for all
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

create policy "deals_staff_insert" on public.deals for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and p.role = 'staff'
    )
    and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    and submit_status = 'draft'
    and (
      appo_employee_id = (select auth.uid())
      or closer_employee_id = (select auth.uid())
    )
  );

create policy "deals_staff_update" on public.deals for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and p.role = 'staff'
    )
    and (
      deals.appo_employee_id = (select auth.uid())
      or deals.closer_employee_id = (select auth.uid())
    )
    and deals.submit_status in ('draft', 'rejected')
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = deals.company_id
        and p.role = 'staff'
    )
    and (
      deals.appo_employee_id = (select auth.uid())
      or deals.closer_employee_id = (select auth.uid())
    )
    and (
      deals.submit_status in ('draft', 'rejected')
      or (
        deals.submit_status = 'submitted'
        and deals.submitted_by is not distinct from (select auth.uid())
      )
    )
  );

create policy "deals_staff_delete" on public.deals for delete using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = deals.company_id
      and p.role = 'staff'
  )
  and (
    deals.appo_employee_id = (select auth.uid())
    or deals.closer_employee_id = (select auth.uid())
  )
  and deals.submit_status = 'draft'
);

-- ---------- Seed: その他（4%/4%）----------
insert into public.deal_incentive_rates (company_id, machine_type, role, rate, is_default)
values
  ('00000000-0000-0000-0000-000000000001', 'その他', 'appo', 0.04, true),
  ('00000000-0000-0000-0000-000000000001', 'その他', 'closer', 0.04, true)
on conflict (company_id, machine_type, role) do update set
  rate = excluded.rate,
  updated_at = now();
