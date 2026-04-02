import type { SupabaseClient } from "@supabase/supabase-js";

/** 表示ラベルが会社の有効カテゴリと一致するか */
export async function isActiveExpenseCategoryLabel(
  supabase: SupabaseClient,
  companyId: string,
  label: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("expense_categories")
    .select("id")
    .eq("company_id", companyId)
    .eq("label", label)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}
