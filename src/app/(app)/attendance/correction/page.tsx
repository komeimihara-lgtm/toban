import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 旧URL互換: 勤怠のサブ画面へ統合 */
export default function AttendanceCorrectionRedirectPage() {
  redirect("/my/attendance/correction");
}
