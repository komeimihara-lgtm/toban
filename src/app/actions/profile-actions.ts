"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveProfileSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const lineUserId = String(formData.get("line_user_id") ?? "").trim();
  const birthRaw = String(formData.get("birth_date") ?? "").trim();
  const emergencyName = String(formData.get("emergency_name") ?? "").trim();
  const emergencyRelation = String(formData.get("emergency_relation") ?? "").trim();
  const emergencyContact = String(formData.get("emergency_contact") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const birth_date = birthRaw.length > 0 ? birthRaw : null;

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName || null,
      phone: phone || null,
      address: address || null,
      line_user_id: lineUserId || null,
      birth_date,
      emergency_name: emergencyName || null,
      emergency_relation: emergencyRelation || null,
      emergency_contact: emergencyContact || null,
    })
    .eq("auth_user_id", user.id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/my/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordWithCurrentAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("new_password_confirm") ?? "");

  if (!current || !next) {
    return { ok: false, message: "パスワードを入力してください" };
  }
  if (next.length < 8) {
    return { ok: false, message: "新しいパスワードは8文字以上にしてください" };
  }
  if (next !== confirm) {
    return { ok: false, message: "新しいパスワードが一致しません" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "メールアドレスが取得できません" };

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (authErr) {
    return { ok: false, message: "現在のパスワードが正しくありません" };
  }

  const { error: upErr } = await supabase.auth.updateUser({ password: next });
  if (upErr) return { ok: false, message: upErr.message };

  return { ok: true };
}
