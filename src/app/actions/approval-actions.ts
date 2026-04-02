"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { revalidatePath } from "next/cache";

async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };
  const { data: p } = await supabase
    .from("profiles")
    .select("role, full_name, id")
    .eq("id", user.id)
    .single();
  if (!isAdminRole((p as { role?: string })?.role ?? "")) {
    return { supabase, ok: false as const };
  }
  return { supabase, ok: true as const, user, profile: p };
}

export async function approveExpenseClaim(id: string) {
  const ctx = await ensureAdmin();
  if (!ctx.ok) return { ok: false as const };
  const { error } = await ctx.supabase
    .from("expense_claims")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const };
  revalidatePath("/approval");
  revalidatePath("/expenses/audit");
  return { ok: true as const };
}

export async function rejectExpenseClaim(id: string, reason: string) {
  if (!reason.trim()) return { ok: false as const };
  const ctx = await ensureAdmin();
  if (!ctx.ok) return { ok: false as const };
  const { error } = await ctx.supabase
    .from("expense_claims")
    .update({
      status: "rejected",
      reject_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false as const };

  const { data: row } = await ctx.supabase
    .from("expense_claims")
    .select("user_id")
    .eq("id", id)
    .single();
  const uid = (row as { user_id: string } | null)?.user_id;
  if (uid) {
    await ctx.supabase.from("app_notifications").insert({
      user_id: uid,
      type: "expense_rejected",
      title: "経費が差戻されました",
      body: reason.trim(),
    });
  }

  revalidatePath("/approval");
  revalidatePath("/my/expenses");
  return { ok: true as const };
}

export async function approveLeaveRequest(id: string) {
  const ctx = await ensureAdmin();
  if (!ctx.ok) return { ok: false as const };

  const { error } = await ctx.supabase
    .from("leave_requests")
    .update({ status: "approved" })
    .eq("id", id);
  if (error) return { ok: false as const };

  revalidatePath("/approval");
  return { ok: true as const };
}

export async function rejectLeaveRequest(id: string, reason: string) {
  if (!reason.trim()) return { ok: false as const };
  const ctx = await ensureAdmin();
  if (!ctx.ok) return { ok: false as const };
  const { error } = await ctx.supabase
    .from("leave_requests")
    .update({ status: "rejected", reject_reason: reason.trim() })
    .eq("id", id);
  if (error) return { ok: false as const };
  revalidatePath("/approval");
  return { ok: true as const };
}

/** Form: hidden id */
export async function approveExpenseFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await approveExpenseClaim(id);
}

export async function rejectExpenseFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!id) return;
  await rejectExpenseClaim(id, reason);
}

export async function approveLeaveFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await approveLeaveRequest(id);
}

export async function rejectLeaveFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!id) return;
  await rejectLeaveRequest(id, reason);
}
