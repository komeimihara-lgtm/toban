-- ai_summary 更新のため owner/approver に UPDATE を許可
DROP POLICY IF EXISTS "ownerのみ更新可" ON public.company_documents;
CREATE POLICY "ownerのみ更新可" ON public.company_documents
  FOR UPDATE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'approver')
    )
  );
