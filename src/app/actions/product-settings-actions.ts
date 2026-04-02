"use server";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMPANY_ID } from "@/lib/company";
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
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isAdminRole((profile as { role?: string })?.role ?? "")) {
    redirect("/my");
  }
  return supabase;
}

export async function createProductAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const costRaw = String(formData.get("cost_price") ?? "0");
  const notes = String(formData.get("notes") ?? "").trim();
  const cost_price = Number(costRaw) || 0;
  if (!name) return;

  const supabase = await adminSupabase();
  await supabase.from("products").insert({
    company_id: DEFAULT_COMPANY_ID,
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

  const supabase = await adminSupabase();
  await supabase
    .from("products")
    .update({
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/settings");
}
