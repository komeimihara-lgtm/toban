"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function buildExpenseDescription(formData: FormData): string {
  const kind = String(formData.get("claim_kind") ?? "expense").trim();
  const payDate = String(formData.get("pay_date") ?? "").trim();
  const payee = String(formData.get("payee") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const participants = String(formData.get("participants") ?? "").trim();
  const routeFrom = String(formData.get("route_from") ?? "").trim();
  const routeTo = String(formData.get("route_to") ?? "").trim();
  const legacyDesc = String(formData.get("description") ?? "").trim();

  const kindLabels: Record<string, string> = {
    expense: "経費精算",
    travel: "出張精算",
    advance: "仮払申請",
    advance_settle: "仮払精算",
  };
  const head = `【${kindLabels[kind] ?? kind}】`;

  const lines: string[] = [head];
  if (payDate) lines.push(`支払日: ${payDate}`);
  if (payee) lines.push(`支払先: ${payee}`);
  if (routeFrom || routeTo) {
    lines.push(`区間: ${routeFrom || "—"} → ${routeTo || "—"}`);
  }
  if (participants) lines.push(`参加者: ${participants}`);
  if (purpose) lines.push(`用途・目的: ${purpose}`);
  else if (legacyDesc) lines.push(legacyDesc);

  return lines.filter(Boolean).join("\n");
}

export async function createExpenseClaim(formData: FormData): Promise<void> {
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim();
  const description = buildExpenseDescription(formData);
  if (!category || !Number.isFinite(amount) || amount <= 0) {
    redirect("/my/expenses?expense=e_input");
  }
  if (!description || description.length < 3) {
    redirect("/my/expenses?expense=e_input");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/expenses");

  const { error } = await supabase.from("expense_claims").insert({
    user_id: user.id,
    amount,
    category,
    description: description || null,
    status: "step1_pending",
  });
  if (error) redirect("/my/expenses?expense=e_save");
  revalidatePath("/my/expenses");
  revalidatePath("/my");
  revalidatePath("/approval");
  redirect("/my/expenses?expense=ok");
}

export async function resubmitExpenseClaim(formData: FormData): Promise<void> {
  const prevId = String(formData.get("previous_id") ?? "");
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim();
  const description = buildExpenseDescription(formData);
  if (!prevId || !category || !Number.isFinite(amount) || amount <= 0) {
    redirect("/my/expenses?expense=e_input");
  }
  if (!description || description.length < 3) {
    redirect("/my/expenses?expense=e_input");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my/expenses");

  const { data: prev } = await supabase
    .from("expense_claims")
    .select("id, status, user_id")
    .eq("id", prevId)
    .single();
  if (!prev || (prev as { user_id: string }).user_id !== user.id) {
    redirect("/my/expenses?expense=e_prev");
  }
  if ((prev as { status: string }).status !== "rejected") {
    redirect("/my/expenses?expense=e_status");
  }

  const { error } = await supabase.from("expense_claims").insert({
    user_id: user.id,
    amount,
    category,
    description: description || null,
    status: "step1_pending",
    previous_claim_id: prevId,
  });
  if (error) redirect("/my/expenses?expense=e_resubmit");
  revalidatePath("/my/expenses");
  revalidatePath("/approval");
  redirect("/my/expenses?expense=ok_resubmit");
}
