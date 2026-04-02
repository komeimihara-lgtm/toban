-- =============================================================================
-- 014_auto_approval_rules.sql
-- カテゴリ別自動承認ルール、承認ログ拡張、expenses.auto_approved
-- =============================================================================

-- ---------- approval_logs.action に AI 自動承認 ----------
alter table public.approval_logs drop constraint if exists approval_logs_action_check;
alter table public.approval_logs add constraint approval_logs_action_check
  check (action in ('step1_approve', 'step2_approve', 'reject', 'ai_auto_approve'));

-- ---------- expenses.auto_approved ----------
alter table public.expenses add column if not exists auto_approved boolean not null default false;

comment on column public.expenses.auto_approved is 'AIルール・スコアにより自動的に approved になったか';

-- ---------- auto_approval_rules スキーマ拡張（旧 rule_name / is_active から移行） ----------
alter table public.auto_approval_rules add column if not exists category text;
alter table public.auto_approval_rules add column if not exists per_person boolean not null default false;
alter table public.auto_approval_rules add column if not exists is_enabled boolean;
alter table public.auto_approval_rules add column if not exists updated_by uuid references public.profiles (id) on delete set null;
alter table public.auto_approval_rules add column if not exists updated_at timestamptz not null default now();

update public.auto_approval_rules
set category = coalesce(category, rule_name)
where category is null and rule_name is not null;

update public.auto_approval_rules
set is_enabled = coalesce(is_enabled, is_active, true)
where is_enabled is null;

update public.auto_approval_rules set is_enabled = true where is_enabled is null;

alter table public.auto_approval_rules alter column is_enabled set not null;

alter table public.auto_approval_rules drop column if exists rule_name;
alter table public.auto_approval_rules drop column if exists is_active;

delete from public.auto_approval_rules a
  using public.auto_approval_rules b
  where a.id > b.id
    and a.company_id = b.company_id
    and a.category is not distinct from b.category;

delete from public.auto_approval_rules where category is null or category = '';

alter table public.auto_approval_rules alter column category set not null;

drop index if exists auto_approval_rules_company_category_uidx;
create unique index auto_approval_rules_company_category_uidx
  on public.auto_approval_rules (company_id, category);

-- ---------- RLS: 全員参照可・更新は owner のみ ----------
drop policy if exists "auto_rules_admin" on public.auto_approval_rules;

create policy "auto_rules_select_company"
  on public.auto_approval_rules for select to authenticated
  using (company_id = public.auth_user_company_id());

create policy "auto_rules_owner_insert"
  on public.auto_approval_rules for insert to authenticated
  with check (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy "auto_rules_owner_update"
  on public.auto_approval_rules for update to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (company_id = public.auth_user_company_id());

create policy "auto_rules_owner_delete"
  on public.auto_approval_rules for delete to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- ---------- シード（全テナントに同じデフォルトを投入。既存行は更新） ----------
insert into public.auto_approval_rules (
  company_id,
  category,
  max_amount,
  per_person,
  is_enabled,
  updated_at
)
select
  c.id,
  v.category,
  v.max_amount,
  v.per_person,
  v.is_enabled,
  now()
from public.companies c
cross join (
  values
    ('ホテル・宿泊', 7000::numeric, false, true),
    ('タクシー', 1000::numeric, false, true),
    ('飲食（個人）', 2000::numeric, false, true),
    ('接待交際費', 5000::numeric, true, true),
    ('交通費（電車）', 3000::numeric, false, true),
    ('消耗品費', 3000::numeric, false, true),
    ('レンタカー', 8000::numeric, false, true),
    ('書籍・研修費', 5000::numeric, false, true),
    ('通信費', 5000::numeric, false, true),
    ('広告宣伝費', 0::numeric, false, false),
    ('出張費（交通）', 10000::numeric, false, true),
    ('出張費（宿泊）', 7000::numeric, false, true)
) as v (category, max_amount, per_person, is_enabled)
on conflict (company_id, category) do update
set
  max_amount = excluded.max_amount,
  per_person = excluded.per_person,
  is_enabled = excluded.is_enabled,
  updated_at = now();
