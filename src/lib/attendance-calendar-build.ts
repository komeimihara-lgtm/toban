/** 月次カレンダー用セル（JST の暦日） */

export type CalendarDayKind =
  | "empty"
  | "weekend"
  | "work"
  | "leave_full"
  | "leave_half"
  | "neutral";

export type CalendarCell = {
  key: string | null;
  dayNum: number | null;
  kind: CalendarDayKind;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function weekdayJstYmd(y: number, m: number, d: number): number {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  const dt = new Date(`${iso}T12:00:00+09:00`);
  const w = dt.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  });
  const map: Record<string, number> = {
    日: 0,
    月: 1,
    火: 2,
    水: 3,
    木: 4,
    金: 5,
    土: 6,
  };
  return map[w] ?? 0;
}

export function daysInMonthUtc(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function buildMonthCells(
  y: number,
  m: number,
  classify: (ymd: string) => CalendarDayKind,
): CalendarCell[] {
  const dim = daysInMonthUtc(y, m);
  const startWeekday = weekdayJstYmd(y, m, 1);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ key: null, dayNum: null, kind: "empty" });
  }
  for (let d = 1; d <= dim; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    let kind = classify(key);
    const wd = weekdayJstYmd(y, m, d);
    if (kind === "neutral" && (wd === 0 || wd === 6)) {
      kind = "weekend";
    }
    cells.push({ key, dayNum: d, kind });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: null, dayNum: null, kind: "empty" });
  }
  return cells;
}

export function eachDayKeys(start: string, end: string): string[] {
  const out: string[] = [];
  const startMs = Date.parse(`${start}T12:00:00+09:00`);
  const endMs = Date.parse(`${end}T12:00:00+09:00`);
  for (let t = startMs; t <= endMs; t += 86400000) {
    out.push(
      new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }),
    );
  }
  return out;
}

export function paidLeaveDaysInMonth(
  leaves: { start_date: string; end_date: string; kind: string }[],
  y: number,
  m: number,
): number {
  const prefix = `${y}-${pad(m)}-`;
  let total = 0;
  for (const L of leaves) {
    for (const key of eachDayKeys(L.start_date, L.end_date)) {
      if (!key.startsWith(prefix)) continue;
      if (L.kind === "full") total += 1;
      else if (L.kind === "half") total += 0.5;
      else total += 0.25;
    }
  }
  return Math.round(total * 100) / 100;
}
