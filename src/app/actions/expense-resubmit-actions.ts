"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function resubmitRejectedExpenseAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "id がありません" };

  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const paid_date = String(formData.get("paid_date") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const type = String(formData.get("type") ?? "expense").trim();

  if (!category || !paid_date || !purpose || !Number.isFinite(amount)) {
    return { ok: false, message: "必須項目を入力してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { data: row, error: fe } = await supabase
    .from("expenses")
    .select("id, status, submitter_id")
    .eq("id", id)
    .maybeSingle();

  if (fe || !row) return { ok: false, message: "申請が見つかりません" };
  const r = row as { status: string; submitter_id: string };
  if (r.submitter_id !== user.id) return { ok: false, message: "権限がありません" };
  if (r.status !== "rejected") return { ok: false, message: "差戻し状態の申請のみ再提出できます" };

  const now = new Date().toISOString();
  const { error: up } = await supabase
    .from("expenses")
    .update({
      category,
      amount,
      paid_date,
      purpose,
      vendor: vendor || "",
      type: ["expense", "travel", "advance", "advance_settle"].includes(type)
        ? type
        : "expense",
      status: "step1_pending",
      rejection_reason: null,
      rejected_by_id: null,
      step1_approved_by: null,
      step1_approved_at: null,
      step2_approved_by: null,
      step2_approved_at: null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("submitter_id", user.id)
    .eq("status", "rejected");

  if (up) return { ok: false, message: up.message };

  revalidatePath("/my/expenses");
  revalidatePath("/approval");
  return { ok: true };
}
