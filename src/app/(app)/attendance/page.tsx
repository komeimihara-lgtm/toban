import { redirect } from "next/navigation";

/** 個人の勤怠・打刻は /my/attendance に統一 */
export default function AttendanceRootRedirectPage() {
  redirect("/my/attendance");
}
