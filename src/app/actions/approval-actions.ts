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

function consumedLeaveDays(lr: {
  start_date: string;
  end_date: string;
  kind: string;
}): number {
  const s = new Date(`${lr.start_date}T12:00:00+09:00`);
  const e = new Date(`${lr.end_date}T12:00:00+09:00`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return 1;
  const span = Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1);
  if (lr.kind === "full") return span;
  if (lr.kind === "half") return span * 0.5;
  return Math.max(0.25, span * 0.25);
}

export async function approveLeaveRequest(id: string) {
  const ctx = await ensureAdmin();
  if (!ctx.ok) return { ok: false as const };

  const { data: lr, error: fe } = await ctx.supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, kind, status")
    .eq("id", id)
    .maybeSingle();
  if (fe || !lr) return { ok: false as const };
  const row = lr as {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    kind: string;
    status: string;
  };
  if (row.status !== "step1_pending") return { ok: false as const };

  const need = consumedLeaveDays(row);

  const { data: grants } = await ctx.supabase
    .from("paid_leave_grants")
    .select("id, days_remaining, days_used, grant_date")
    .eq("employee_id", row.user_id)
    .gt("days_remaining", 0)
    .order("grant_date", { ascending: true });

  let rem = need;
  for (const g of grants ?? []) {
    const gr = g as { id: string; days_remaining: number; days_used: number };
    const take = Math.min(rem, Number(gr.days_remaining));
    if (take <= 0) continue;
    const { error: ge } = await ctx.supabase
      .from("paid_leave_grants")
      .update({
        days_remaining: Number(gr.days_remaining) - take,
        days_used: Number(gr.days_used) + take,
      })
      .eq("id", gr.id);
    if (ge) return { ok: false as const };
    rem -= take;
    if (rem <= 0.0001) break;
  }

  const { data: bal } = await ctx.supabase
    .from("paid_leave_balances")
    .select("days_remaining")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (bal) {
    const dr = Number((bal as { days_remaining: number }).days_remaining);
    await ctx.supabase
      .from("paid_leave_balances")
      .update({
        days_remaining: Math.max(0, dr - need),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", row.user_id);
  }

  const { error } = await ctx.supabase
    .from("leave_requests")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "step1_pending");
  if (error) return { ok: false as const };

  revalidatePath("/approval");
  revalidatePath("/my/leave");
  revalidatePath("/my");
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
