-- 入社書類アップロード用ストレージ（認証ユーザーのみ自分のプレフィックスに書き込み可）

insert into storage.buckets (id, name, public)
values ('onboarding-docs', 'onboarding-docs', false)
on conflict (id) do nothing;

drop policy if exists "onboarding_docs_insert_own" on storage.objects;
create policy "onboarding_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'onboarding-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "onboarding_docs_select_own" on storage.objects;
create policy "onboarding_docs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'onboarding-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "onboarding_docs_select_admin" on storage.objects;
create policy "onboarding_docs_select_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'onboarding-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'approver')
    )
  );
