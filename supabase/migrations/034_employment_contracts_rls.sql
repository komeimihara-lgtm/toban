-- profiles に依存しないテナント解決・雇用契約 RLS（employees ベース）

create or replace function public.auth_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.company_id
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.auth_user_company_id() to authenticated;

drop policy if exists "employment_contracts_select_self" on public.employment_contracts;
create policy "employment_contracts_select_self"
  on public.employment_contracts for select to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.id = employment_contracts.employee_id
        and e.auth_user_id = auth.uid()
        and e.company_id = employment_contracts.company_id
    )
  );

drop policy if exists "employment_contracts_admin_all" on public.employment_contracts;
create policy "employment_contracts_admin_all"
  on public.employment_contracts for all to authenticated
  using (
    exists (
      select 1
      from public.employees e
      where e.auth_user_id = auth.uid()
        and e.company_id = employment_contracts.company_id
        and e.role in ('owner', 'approver')
    )
  )
  with check (
    exists (
      select 1
      from public.employees e
      where e.auth_user_id = auth.uid()
        and e.company_id = employment_contracts.company_id
        and e.role in ('owner', 'approver')
    )
  );
