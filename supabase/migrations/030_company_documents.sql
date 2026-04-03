-- ============================================================
-- 1. company_documents テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  document_type text DEFAULT 'rules',
  ai_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "社員は閲覧可" ON public.company_documents
  FOR SELECT TO authenticated
  USING (company_id = public.auth_user_company_id());

CREATE POLICY "ownerのみ追加可" ON public.company_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  );

CREATE POLICY "ownerのみ削除可" ON public.company_documents
  FOR DELETE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  );

-- ============================================================
-- 2. Supabase Storage: company-documents バケット
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "社員は閲覧可" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-documents');

CREATE POLICY "ownerのみアップロード可" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  );

CREATE POLICY "ownerのみ削除可" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  );
