"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function adminSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  const pr = profile as { role?: string; company_id?: string } | null;
  if (!isAdminRole(pr?.role ?? "") || !pr?.company_id) {
    redirect("/my");
  }
  return { supabase, companyId: pr.company_id };
}

export async function createProductAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const costRaw = String(formData.get("cost_price") ?? "0");
  const notes = String(formData.get("notes") ?? "").trim();
  const cost_price = Number(costRaw) || 0;
  if (!name) return;

  const { supabase, companyId } = await adminSupabase();
  await supabase.from("products").insert({
    company_id: companyId,
    name,
    cost_price,
    notes: notes || null,
    is_active: true,
  });
  revalidatePath("/settings");
}

export async function setProductActiveAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const is_active = formData.get("is_active") === "true";
  if (!id) return;

  const { supabase, companyId } = await adminSupabase();
  await supabase
    .from("products")
    .update({
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);
  revalidatePath("/settings");
}
