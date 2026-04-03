-- 経費AI監査・自動承認用カラム
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS audit_score integer,
  ADD COLUMN IF NOT EXISTS audit_result jsonb,
  ADD COLUMN IF NOT EXISTS audit_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;
