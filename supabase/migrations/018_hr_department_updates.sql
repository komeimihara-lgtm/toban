-- =============================================================================
-- 018_hr_department_updates.sql — 部署の整合（プロフィール・hr_employees）
-- public.employees は user_id のみのオンボーディング用のため、部署は profiles 側を更新
-- =============================================================================

UPDATE public.profiles p SET
  department_id = (
    SELECT id FROM public.departments d
    WHERE d.company_id = p.company_id AND d.name = '管理本部'
    LIMIT 1
  )
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
  AND (p.full_name = '後藤 裕美子' OR p.full_name = '後藤');

UPDATE public.profiles p SET
  department_id = (
    SELECT id FROM public.departments d
    WHERE d.company_id = p.company_id AND d.name = 'サービス部'
    LIMIT 1
  )
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
  AND (
    p.full_name IN ('小山 智子', '吉田 浩', '小山', '吉田')
  );

UPDATE public.hr_employees h SET
  department_id = (
    SELECT id FROM public.departments d
    WHERE d.company_id = h.company_id AND d.name = '管理本部'
    LIMIT 1
  )
WHERE h.company_id = '00000000-0000-0000-0000-000000000001'
  AND (h.full_name IN ('後藤', '後藤 裕美子'));

UPDATE public.hr_employees h SET
  department_id = (
    SELECT id FROM public.departments d
    WHERE d.company_id = h.company_id AND d.name = 'サービス部'
    LIMIT 1
  )
WHERE h.company_id = '00000000-0000-0000-0000-000000000001'
  AND h.full_name IN ('小山', '吉田', '小山 智子', '吉田 浩');
