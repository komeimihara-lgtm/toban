"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AutoRulePatch = {
  id: string;
  max_amount: number;
  per_person: boolean;
  is_enabled: boolean;
};

export async function saveAutoApprovalRulesAction(patches: AutoRulePatch[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "ログインが必要です。" };
  }

  const { data: pr } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  const role = (pr as { role?: string } | null)?.role;
  const companyId = (pr as { company_id?: string } | null)?.company_id;
  if (role !== "owner" || !companyId) {
    return { ok: false as const, error: "owner のみ編集できます。" };
  }

  const now = new Date().toISOString();
  for (const row of patches) {
    const { error } = await supabase
      .from("auto_approval_rules")
      .update({
        max_amount: row.max_amount,
        per_person: row.per_person,
        is_enabled: row.is_enabled,
        updated_by: user.id,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("company_id", companyId);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  revalidatePath("/settings/auto-approval");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
