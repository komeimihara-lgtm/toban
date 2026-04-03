"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { revalidatePath } from "next/cache";

export async function resolveRetentionAlertAction(formData: FormData): Promise<void> {
  const id = formData.get("id")?.toString()?.trim();
  const employeeId = formData.get("employee_id")?.toString()?.trim();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: me } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!isAdminRole((me as { role?: string })?.role ?? "")) return;

  const { error } = await supabase
    .from("retention_alerts")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", id)
    .eq("is_resolved", false);

  if (error) {
    console.error("[retention] resolve failed:", error.message);
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/employees");
  if (employeeId) {
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath(`/employees/${employeeId}/retention`);
  }
}
