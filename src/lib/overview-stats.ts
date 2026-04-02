import type { SupabaseClient } from "@supabase/supabase-js";

export async function countExpenseApprovalBadges(
  supabase: SupabaseClient,
  role: string,
): Promise<number> {
  let n = 0;
  if (role === "approver") {
    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("status", "step1_pending");
    n += count ?? 0;
  }
  if (role === "owner") {
    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("status", "step2_pending");
    n += count ?? 0;
  }
  return n;
}
