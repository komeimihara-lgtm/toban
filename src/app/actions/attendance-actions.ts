"use server";

import { revalidatePath } from "next/cache";

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
