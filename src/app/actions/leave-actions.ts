"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequestAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "ログインが必要です。" };
  }

  const start_date = String(formData.get("start_date") ?? "").trim();
  const end_date = String(formData.get("end_date") ?? "").trim();
  const kind = String(formData.get("kind") ?? "full");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!start_date || !end_date) {
    return { ok: false as const, error: "開始日・終了日を入力してください。" };
  }
  if (start_date > end_date) {
    return { ok: false as const, error: "日付の範囲が不正です。" };
  }
  if (!["full", "half", "hour"].includes(kind)) {
    return { ok: false as const, error: "種別が不正です。" };
  }

  const { data: pr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  const companyId = (pr as { company_id?: string } | null)?.company_id;
  if (!companyId) {
    return { ok: false as const, error: "会社情報が取得できません。" };
  }

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    company_id: companyId,
    start_date,
    end_date,
    kind,
    reason,
    status: "step1_pending",
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/my/leave");
  revalidatePath("/my");
  revalidatePath("/my/attendance/calendar");
  revalidatePath("/approval");
  return { ok: true as const };
}
