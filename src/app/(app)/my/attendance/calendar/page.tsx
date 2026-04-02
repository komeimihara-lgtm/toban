import { AttendanceCalendarClient } from "@/components/attendance/attendance-calendar-client";
import {
  buildMonthCells,
  daysInMonthUtc,
  eachDayKeys,
  paidLeaveDaysInMonth,
  type CalendarDayKind,
} from "@/lib/attendance-calendar-build";
import {
  jstDateKey,
  summarizePunchesInRange,
} from "@/lib/attendance-summary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function MyAttendanceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  if (!isSupabaseConfigured()) return <p>Supabase 未設定</p>;
  const sp = await searchParams;
  const now = new Date();
  let y = Number(sp.y);
  let m = Number(sp.m);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) y = now.getFullYear();
  if (!Number.isFinite(m) || m < 1 || m > 12) m = now.getMonth() + 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const monthStartIso = `${y}-${pad(m)}-01T00:00:00+09:00`;
  const monthEndIso = `${nextY}-${pad(nextM)}-01T00:00:00+09:00`;

  const { data: punchesRaw, error: pe } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", monthStartIso)
    .lt("punched_at", monthEndIso);

  if (pe) {
    return <p className="text-sm text-red-600">打刻データの取得に失敗しました。</p>;
  }

  const punches = punchesRaw ?? [];
  const workSet = new Set<string>();
  for (const p of punches) {
    if ((p as { punch_type: string }).punch_type === "clock_in") {
      workSet.add(jstDateKey((p as { punched_at: string }).punched_at));
    }
  }

  const { data: leavesRaw } = await supabase
    .from("leave_requests")
    .select("start_date, end_date, kind, status")
    .eq("user_id", user.id)
    .eq("status", "approved");

  const leaves = (leavesRaw ?? []) as {
    start_date: string;
    end_date: string;
    kind: string;
    status: string;
  }[];

  const leaveFull = new Set<string>();
  const leaveHalf = new Set<string>();
  for (const L of leaves) {
    for (const k of eachDayKeys(L.start_date, L.end_date)) {
      if (L.kind === "full") {
        leaveFull.add(k);
      } else {
        leaveHalf.add(k);
      }
    }
  }

  const classify = (ymd: string): CalendarDayKind => {
    if (leaveFull.has(ymd)) return "leave_full";
    if (leaveHalf.has(ymd)) return "leave_half";
    if (workSet.has(ymd)) return "work";
    return "neutral";
  };

  const cells = buildMonthCells(y, m, classify);
  const dim = daysInMonthUtc(y, m);
  const endOfMonthJst = new Date(
    `${y}-${pad(m)}-${pad(dim)}T23:59:59+09:00`,
  );
  const summaryNow =
    endOfMonthJst.getTime() < Date.now() ? endOfMonthJst : new Date();
  const summary = summarizePunchesInRange(punches, { now: summaryNow });
  const paidLeaveDays = paidLeaveDaysInMonth(leaves, y, m);

  return (
    <AttendanceCalendarClient
      year={y}
      month={m}
      cells={cells}
      workDays={summary.workDays}
      totalWorkMinutes={summary.totalWorkMinutes}
      paidLeaveDays={paidLeaveDays}
    />
  );
}
