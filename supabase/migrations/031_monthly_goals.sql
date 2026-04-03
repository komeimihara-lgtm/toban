-- ============================================================
-- 月間目標・KPI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  theme text NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]',
  kpis jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES public.employees(id),
  approved_at timestamptz,
  result_input jsonb,
  result_submitted_at timestamptz,
  ai_evaluation text,
  ai_score int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

-- ============================================================
-- チェックシート
-- ============================================================
CREATE TABLE IF NOT EXISTS public.check_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  self_check jsonb NOT NULL DEFAULT '[]',
  manager_check jsonb NOT NULL DEFAULT '[]',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

-- ============================================================
-- 査定
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  overall_score numeric,
  ai_summary text,
  reviewer_comment text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_or_admin" ON public.monthly_goals FOR ALL TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','approver'))
  );

CREATE POLICY "self_or_admin" ON public.check_sheets FOR ALL TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','approver'))
  );

CREATE POLICY "self_or_admin" ON public.performance_reviews FOR ALL TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid() AND role IN ('owner','approver'))
  );
