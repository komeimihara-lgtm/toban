-- 案件の支払い方法（既存環境では IF NOT EXISTS でスキップ）
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_method text;
