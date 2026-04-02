import { getProfile, getSessionUser } from "@/lib/api-auth";
import { jstDayRangeIso } from "@/lib/jst-day-range";
import { NextResponse } from "next/server";

/** 指定日（JST）の最初の出勤・最後の退勤（ISO 文字列） */
export async function GET(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD が必要です" }, { status: 400 });
  }

  let startIso: string;
  let endIsoExclusive: string;
  try {
    const r = jstDayRangeIso(date);
    startIso = r.startIso;
    endIsoExclusive = r.endIsoExclusive;
  } catch {
    return NextResponse.json({ error: "日付が不正です" }, { status: 400 });
  }

  const { data: punchesRaw, error } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", startIso)
    .lt("punched_at", endIsoExclusive)
    .order("punched_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const punches = punchesRaw ?? [];
  let original_clock_in: string | null = null;
  let original_clock_out: string | null = null;
  for (const p of punches) {
    const row = p as { punch_type: string; punched_at: string };
    if (row.punch_type === "clock_in" && !original_clock_in) {
      original_clock_in = row.punched_at;
    }
    if (row.punch_type === "clock_out") {
      original_clock_out = row.punched_at;
    }
  }

  return NextResponse.json({
    target_date: date,
    original_clock_in,
    original_clock_out,
  });
}
