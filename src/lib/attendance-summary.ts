/** 勤怠サマリー計算（JST の日付で集計） */

import { calcBreakTime } from "@/lib/attendance-storage";

const MS_MIN = 60_000;

export type PunchLike = {
  punch_type: string;
  punched_at: string;
};

export function jstDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

/** 1 日あたりの所定労働（分）。デフォルト 8 時間。 */
export function summarizePunchesInRange(
  rows: PunchLike[],
  opts: { now?: Date; standardDayMinutes?: number } = {},
): {
  workDays: number;
  totalWorkMinutes: number;
  overtimeMinutes: number;
} {
  const now = opts.now ?? new Date();
  const standard = opts.standardDayMinutes ?? 480;

  const byDay = new Map<string, PunchLike[]>();
  for (const r of rows) {
    const dk = jstDateKey(r.punched_at);
    const arr = byDay.get(dk) ?? [];
    arr.push(r);
    byDay.set(dk, arr);
  }

  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

  let totalWork = 0;
  let overtime = 0;
  let workDays = 0;

  for (const [, list] of byDay) {
    list.sort(
      (a, b) =>
        new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    const times = list.map((x) => ({
      type: x.punch_type,
      t: new Date(x.punched_at),
    }));

    const firstIn = times.find((x) => x.type === "clock_in");
    const lastOutRev = [...times].reverse().find((x) => x.type === "clock_out");

    if (!firstIn) continue;
    workDays += 1;

    let endT: Date | undefined = lastOutRev?.t;
    const dayKey = firstIn.t.toLocaleDateString("en-CA", {
      timeZone: "Asia/Tokyo",
    });
    if (!endT && dayKey === todayKey) {
      endT = now;
    }
    if (!endT) {
      continue;
    }

    const gross = Math.max(
      0,
      Math.round((endT.getTime() - firstIn.t.getTime()) / MS_MIN),
    );

    const net = Math.max(0, gross - calcBreakTime(gross));
    totalWork += net;
    overtime += Math.max(0, net - standard);
  }

  return {
    workDays,
    totalWorkMinutes: totalWork,
    overtimeMinutes: overtime,
  };
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
}

export function punchTypeLabel(type: string): string {
  switch (type) {
    case "clock_in":
      return "出勤";
    case "clock_out":
      return "退勤";
    case "break_start":
      return "休憩開始";
    case "break_end":
      return "休憩終了";
    default:
      return type;
  }
}
