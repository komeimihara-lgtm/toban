-- AI 審査結果（001_initial に含まれる環境では no-op）
alter table public.expenses add column if not exists audit_result jsonb;
alter table public.expenses add column if not exists audit_at timestamptz;
alter table public.expenses add column if not exists audit_score integer;

comment on column public.expenses.audit_result is 'AI審査レスポンス（verdict, score, issues, summary, suggestions）';
comment on column public.expenses.audit_at is '最終審査実行時刻';
comment on column public.expenses.audit_score is '妥当性スコア 0-100';
