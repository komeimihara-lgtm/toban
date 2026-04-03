import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/types/incentive";

/**
 * Resolve effective role: employees (auth_user_id → user_id) → profiles → "staff"
 * Layout と同じロジックで employees テーブルを優先する
 */
export async function resolveUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: byAuth } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (byAuth) return (byAuth as { role?: string }).role ?? "staff";

  const { data: byUser } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUser) return (byUser as { role?: string }).role ?? "staff";

  return "staff";
}

export async function checkAdminRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const role = await resolveUserRole(supabase, userId);
  return isAdminRole(role);
}
