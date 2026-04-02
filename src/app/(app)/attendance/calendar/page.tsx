import { redirect } from "next/navigation";

/** マイ勤怠の月次カレンダーへ */
export default async function AttendanceCalendarLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.y) q.set("y", sp.y);
  if (sp.m) q.set("m", sp.m);
  const suffix = q.toString() ? `?${q}` : "";
  redirect(`/my/attendance/calendar${suffix}`);
}
