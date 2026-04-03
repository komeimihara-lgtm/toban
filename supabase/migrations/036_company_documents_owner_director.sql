-- 就業規則ドキュメントの追加・更新・削除を owner / director のみに限定（approver は閲覧のみ）

DROP POLICY IF EXISTS "ownerのみ追加可" ON public.company_documents;
CREATE POLICY "ownerのみ追加可" ON public.company_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  );

DROP POLICY IF EXISTS "ownerのみ削除可" ON public.company_documents;
CREATE POLICY "ownerのみ削除可" ON public.company_documents
  FOR DELETE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  );

DROP POLICY IF EXISTS "ownerのみ更新可" ON public.company_documents;
CREATE POLICY "ownerのみ更新可" ON public.company_documents
  FOR UPDATE TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  );

DROP POLICY IF EXISTS "ownerのみアップロード可" ON storage.objects;
CREATE POLICY "ownerのみアップロード可" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  );

DROP POLICY IF EXISTS "ownerのみ削除可" ON storage.objects;
CREATE POLICY "ownerのみ削除可" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner', 'director')
    )
  );
