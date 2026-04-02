"use server";

import { createClient } from "@/lib/supabase/server";
import { signAttendanceQrToken } from "@/lib/attendance-qr-token";
import type { AttendancePunchType } from "@/types";
import { revalidatePath } from "next/cache";

const QR_TTL_SEC = 300;

export type PunchGeo = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

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
  punchType: AttendancePunchType,
  geo?: PunchGeo | null,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }
  if (punchType === "break_start" || punchType === "break_end") {
    return {
      ok: false,
      message:
        "休憩打刻は廃止されました。出勤・退勤の差から労基法準拠の自動休憩控除を適用します。",
    };
  }
  const row: Record<string, unknown> = {
    user_id: user.id,
    punch_type: punchType,
    source: "web",
  };
  if (geo) {
    row.latitude = geo.latitude;
    row.longitude = geo.longitude;
    row.location_accuracy_m = geo.accuracyMeters;
  }
  const { error } = await supabase.from("attendance_punches").insert(row);
  if (error) {
    return { ok: false, message: "打刻に失敗しました" };
  }
  revalidatePath("/my");
  revalidatePath("/my/attendance");
  revalidatePath("/attendance");
  revalidatePath("/attendance/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
