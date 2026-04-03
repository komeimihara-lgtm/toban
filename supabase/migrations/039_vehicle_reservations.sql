-- 039: 社用車予約機能

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL,
  plate_number text,
  branch text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.vehicle_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  purpose text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "全社員閲覧可" ON public.vehicles FOR SELECT TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY "全社員閲覧可" ON public.vehicle_reservations FOR SELECT TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY "全社員予約可" ON public.vehicle_reservations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.auth_user_company_id());

CREATE POLICY "本人のみ削除可" ON public.vehicle_reservations FOR DELETE TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','director'))
  );

-- owner/director のみ車両マスタ操作可
CREATE POLICY "管理者のみ追加可" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','director'))
  );

CREATE POLICY "管理者のみ更新可" ON public.vehicles FOR UPDATE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','director'))
  );

CREATE POLICY "管理者のみ削除可" ON public.vehicles FOR DELETE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','director'))
  );

-- デフォルト車両データ
INSERT INTO public.vehicles (company_id, name, plate_number, branch)
SELECT
  '00000000-0000-0000-0000-000000000001',
  v.name, v.plate, v.branch
FROM (VALUES
  ('社用車1', '品川 xxx-xx', '東京本社'),
  ('社用車2', '品川 xxx-xx', '東京本社'),
  ('社用車3', '品川 xxx-xx', '東京本社'),
  ('社用車4', '福岡 xxx-xx', '福岡支社'),
  ('社用車5', '福岡 xxx-xx', '福岡支社'),
  ('社用車6', '名古屋 xxx-xx', '名古屋支社')
) AS v(name, plate, branch);
