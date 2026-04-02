"use server";

import { createClient } from "@/lib/supabase/server";
import { signAttendanceQrToken } from "@/lib/attendance-qr-token";
import { revalidatePath } from "next/cache";

const QR_TTL_SEC = 300;

export async function generateAttendanceQrToken(
  punchType: "clock_in" | "clock_out",
): Promise<
  | { ok: true; token: string; expiresAtIso: string }
  | { ok: false; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }
  try {
    const exp = Math.floor(Date.now() / 1000) + QR_TTL_SEC;
    const token = signAttendanceQrToken({
      uid: user.id,
      exp,
      pt: punchType,
    });
    return {
      ok: true,
      token,
      expiresAtIso: new Date(exp * 1000).toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "トークン生成に失敗しました";
    return { ok: false, message: msg };
  }
}

export async function punchAttendance(
  punchType: "clock_in" | "clock_out",
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }
  const { error } = await supabase.from("attendance_punches").insert({
    user_id: user.id,
    punch_type: punchType,
    source: "web",
  });
  if (error) {
    return { ok: false, message: "打刻に失敗しました" };
  }
  revalidatePath("/my");
  revalidatePath("/my/attendance");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type CorrectionFormState =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** 打刻修正申請の保存は今後 Supabase 等と接続 */
export async function submitPunchCorrectionRequest(
  _prev: CorrectionFormState | undefined,
  formData: FormData,
): Promise<CorrectionFormState> {
  const targetDate = String(formData.get("target_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!targetDate) {
    return { ok: false, message: "対象日を入力してください。" };
  }
  if (!reason) {
    return { ok: false, message: "理由を入力してください。" };
  }

  revalidatePath("/my/attendance");
  revalidatePath("/attendance/correction");
  return { ok: true, message: "申請を受け付けました。（保存処理は今後接続されます）" };
}
