/** 基準日 ymd（JST の暦日）の [00:00, 翌00:00) を表す ISO 文字列 */
export function jstDayRangeIso(ymd: string): { startIso: string; endIsoExclusive: string } {
  const startMs = Date.parse(`${ymd}T00:00:00+09:00`);
  if (!Number.isFinite(startMs)) {
    throw new Error(`invalid date: ${ymd}`);
  }
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(new Date(endMs));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  const nextYmd = `${y}-${m}-${d}`;
  return {
    startIso: `${ymd}T00:00:00+09:00`,
    endIsoExclusive: `${nextYmd}T00:00:00+09:00`,
  };
}

/** last_working_date の翌日（JST 暦）を YYYY-MM-DD で返す */
export function addOneCalendarDayJst(ymd: string): string {
  const { endIsoExclusive } = jstDayRangeIso(ymd);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(new Date(Date.parse(endIsoExclusive)));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}
