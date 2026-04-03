-- ============================================================
-- 036: 評価担当（manager_id）・五島リーダーロール設定
-- ============================================================

-- ★ 事前に Supabase SQL Editor で実行してください（enum 追加）
-- ALTER TYPE employee_role ADD VALUE IF NOT EXISTS 'leader';

-- manager_id カラム追加
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.employees(id);

-- 五島久美子をリーダーロールに変更
UPDATE public.employees SET role = 'leader' WHERE name = '五島 久美子';

-- ─── manager_id の設定（評価担当）───

-- 中村 和彦が評価：高橋・田村・橋本・小山・吉田
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE name = '中村 和彦')
WHERE name IN ('高橋 賢一', '田村 優平', '橋本 賢一', '小山 智子', '吉田 浩');

-- 大岩 龍喜が評価：川津・飯田・小笠原
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE name = '大岩 龍喜')
WHERE name IN ('川津 知紘', '飯田 祐大', '小笠原 昇太郎');

-- 五島 久美子が評価：稲垣・藤野
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE name = '五島 久美子')
WHERE name IN ('稲垣 知里', '藤野 由美佳');

-- 三原 彩が評価：千葉・松田・後藤
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE name = '三原 彩')
WHERE name IN ('千葉 亜矢子', '松田 剛', '後藤 裕美子');

-- 三原 孔明が評価：中村・大岩・五島・後藤
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE name = '三原 孔明')
WHERE name IN ('中村 和彦', '大岩 龍喜', '五島 久美子', '後藤 裕美子');
