-- ============================================================
-- director / sr ロール追加
-- ============================================================

-- 三原彩を director ロールに変更
UPDATE public.employees
SET role = 'director'
WHERE name = '三原 彩';

-- employees.role の CHECK 制約を更新（存在する場合のみ）
DO $$
BEGIN
  ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_role_check
    CHECK (role IN ('owner', 'director', 'approver', 'sr', 'staff'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- profiles.role の CHECK 制約も更新（存在する場合のみ）
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner', 'director', 'approver', 'sr', 'staff'));
EXCEPTION WHEN others THEN
  NULL;
END $$;
