import type { SupabaseClient } from "@supabase/supabase-js";

export async function getProfileSalesTargetFlag(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_sales_target")
    .eq("id", userId)
    .maybeSingle();
  return Boolean((data as { is_sales_target?: boolean } | null)?.is_sales_target);
}

/** employees.is_sales_target を優先。行がなければ profiles のフラグ。 */
export async function resolveIsSalesTarget(
  supabase: SupabaseClient,
  userId: string,
  profileIsSalesTarget: boolean,
): Promise<boolean> {
  const { data: emp } = await supabase
    .from("employees")
    .select("is_sales_target")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp != null && "is_sales_target" in emp) {
    return Boolean((emp as { is_sales_target: boolean }).is_sales_target);
  }
  return Boolean(profileIsSalesTarget);
}

export async function fetchSalesTargetUserIds(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data: emps } = await supabase
    .from("employees")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("is_sales_target", true);
  const fromEmp = (emps ?? [])
    .map((r) => (r as { user_id: string | null }).user_id)
    .filter((id): id is string => Boolean(id));
  if (fromEmp.length > 0) return [...new Set(fromEmp)];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_sales_target", true);
  return (profs ?? []).map((p) => (p as { id: string }).id);
}
