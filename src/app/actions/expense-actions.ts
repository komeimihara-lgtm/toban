"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExpenseClaim(formData: FormData): Promise<void> {
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!category || !Number.isFinite(amount) || amount <= 0) {
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
  const description = String(formData.get("description") ?? "").trim();
  if (!prevId || !category || !Number.isFinite(amount) || amount <= 0) {
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
