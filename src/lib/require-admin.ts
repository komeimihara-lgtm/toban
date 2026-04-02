import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/types/incentive";

export async function checkAdminRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role ?? "staff";
  return isAdminRole(role);
}
