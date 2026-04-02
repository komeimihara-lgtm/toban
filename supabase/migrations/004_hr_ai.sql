-- HR AI アシスタント: 会話履歴・参照文書（マルチテナント）
-- 実行順の都合でタイムスタンプ接頭辞付き（依頼名 004_hr_ai 相当）

-- =============================================================================
-- hr_conversations
-- =============================================================================
create table if not exists public.hr_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_conversations_messages_array check (jsonb_typeof(messages) = 'array')
);

create index if not exists hr_conversations_employee_updated_idx
  on public.hr_conversations (employee_id, updated_at desc);

create index if not exists hr_conversations_company_id_idx
  on public.hr_conversations (company_id);

comment on table public.hr_conversations is 'AI人事アシスタントの会話。messages は [{role, content}] の配列';

-- =============================================================================
-- hr_documents
-- =============================================================================
create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category text not null
    check (category in ('employment', 'rules', 'evaluation', 'benefits')),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_documents_company_category_idx
  on public.hr_documents (company_id, category)
  where is_active = true;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.hr_conversations enable row level security;

drop policy if exists "hr_conversations_select_own" on public.hr_conversations;
create policy "hr_conversations_select_own"
  on public.hr_conversations for select to authenticated
  using (
    employee_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

drop policy if exists "hr_conversations_insert_own" on public.hr_conversations;
create policy "hr_conversations_insert_own"
  on public.hr_conversations for insert to authenticated
  with check (
    employee_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

drop policy if exists "hr_conversations_update_own" on public.hr_conversations;
create policy "hr_conversations_update_own"
  on public.hr_conversations for update to authenticated
  using (
    employee_id = auth.uid()
    and company_id = public.auth_user_company_id()
  )
  with check (
    employee_id = auth.uid()
    and company_id = public.auth_user_company_id()
  );

alter table public.hr_documents enable row level security;

drop policy if exists "hr_documents_select_tenant" on public.hr_documents;
create policy "hr_documents_select_tenant"
  on public.hr_documents for select to authenticated
  using (
    company_id = public.auth_user_company_id()
    and is_active = true
  );

drop policy if exists "hr_documents_write_owner" on public.hr_documents;
create policy "hr_documents_write_owner"
  on public.hr_documents for all to authenticated
  using (
    company_id = public.auth_user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (
    company_id = public.auth_user_company_id()
  );

-- =============================================================================
-- Seed: レナード株式会社（既定 company id）— 未投入時のみ
-- =============================================================================
insert into public.hr_documents (company_id, category, title, content, is_active)
select '00000000-0000-0000-0000-000000000001', 'employment', '雇用契約の基本事項（概要）',
  $doc$【ダミー文書・実運用時は法務・人事で差し替えてください】

・ 雇用形態: 正社員（試用期間3ヶ月。条件は本採用と同じ）
・ 給与支払日: 毎月25日（休日の場合は前営業日）
・ 所定労働時間: 1週40時間（詳細は就業規則）
・ 勤務地: 本社または配属先（異動時は書面で通知）
・ 秘密保持: 業務上知り得た情報の外部漏えい禁止
・ 退職: 退職希望の場合は原則30日前までに申し出$doc$, true
where not exists (
  select 1 from public.hr_documents d
  where d.company_id = '00000000-0000-0000-0000-000000000001' and d.category = 'employment'
);

insert into public.hr_documents (company_id, category, title, content, is_active)
select '00000000-0000-0000-0000-000000000001', 'rules', '就業規則の要点（概要）',
  $doc$【ダミー文書】

・ 始業 9:00 / 終業 18:00（休憩 60 分）
・ 遅刻・早退・欠勤は上長承認のうえ申請
・ 副業・兼業は事前届出が必要な場合あり
・ ハラスメント: 禁止行為および相談窓口は就業規則に定める
・ 服務規律: 職場の秩序を乱す行為の禁止$doc$, true
where not exists (
  select 1 from public.hr_documents d
  where d.company_id = '00000000-0000-0000-0000-000000000001' and d.category = 'rules'
);

insert into public.hr_documents (company_id, category, title, content, is_active)
select '00000000-0000-0000-0000-000000000001', 'evaluation', '評価制度の概要',
  $doc$【ダミー文書】

・ 半期ごとに目標設定と面談を実施
・ 評価は成果・行動・コンピテンシーの観点を総合（詳細は規程）
・ 目標は具体的かつ測定可能にし、期中で見直し可能
・ インセンティブ: 対象職種・部門は別途ルールに基づき算定（個人の率・実績により変動）
・ 評価を上げるには: 目標の明確化、上司との定期1on1、成果の可視化（数字・事例）$doc$, true
where not exists (
  select 1 from public.hr_documents d
  where d.company_id = '00000000-0000-0000-0000-000000000001' and d.category = 'evaluation'
);

insert into public.hr_documents (company_id, category, title, content, is_active)
select '00000000-0000-0000-0000-000000000001', 'benefits', '福利厚生の概要',
  $doc$【ダミー文書】

・ 有給休暇: 入社日に応じ法定どおり付与（参考: 年次基準では最大20日前後。会社規程を確認）
・ 交通費: 実費支給（申請ルールに従う）
・ 社会保険: 適用条件を満たす場合に加入
・ 慶弔見舞金: 規程に基づく
・ その他: 会社が定める団体保険等$doc$, true
where not exists (
  select 1 from public.hr_documents d
  where d.company_id = '00000000-0000-0000-0000-000000000001' and d.category = 'benefits'
);
