import { getProfile, getSessionUser, isOwner } from "@/lib/api-auth";
import { jstDayRangeIso } from "@/lib/jst-day-range";
import { NextResponse } from "next/server";

function timeToJstIso(ymd: string, hm: string | null | undefined): string | null {
  if (!hm?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = m[2];
  return `${ymd}T${hh}:${mm}:00+09:00`;
}

export async function GET() {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const adminView = isOwner(profile.role);

  const { data: mine, error: e1 } = await supabase
    .from("attendance_corrections")
    .select("*")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  let pending: unknown[] = [];
  if (adminView) {
    const { data: pend, error: e2 } = await supabase
      .from("attendance_corrections")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
    pending = pend ?? [];
  }

  return NextResponse.json({
    items: mine ?? [],
    pending_admin: adminView ? pending : undefined,
    is_admin: adminView,
  });
}

export async function POST(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const body = (await req.json()) as {
    target_date?: string;
    reason?: string;
    requested_clock_in?: string | null;
    requested_clock_out?: string | null;
  };

  const targetDate = String(body.target_date ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "target_date は YYYY-MM-DD" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "理由は必須です" }, { status: 400 });
  }

  const reqIn = timeToJstIso(targetDate, body.requested_clock_in ?? null);
  const reqOut = timeToJstIso(targetDate, body.requested_clock_out ?? null);
  if (!reqIn && !reqOut) {
    return NextResponse.json(
      { error: "修正後の出勤または退勤のいずれかを入力してください" },
      { status: 400 },
    );
  }

  let startIso: string;
  let endIsoExclusive: string;
  try {
    const r = jstDayRangeIso(targetDate);
    startIso = r.startIso;
    endIsoExclusive = r.endIsoExclusive;
  } catch {
    return NextResponse.json({ error: "日付が不正です" }, { status: 400 });
  }

  const { data: punchesRaw, error: pe } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", startIso)
    .lt("punched_at", endIsoExclusive)
    .order("punched_at", { ascending: true });

  if (pe) {
    return NextResponse.json({ error: pe.message }, { status: 500 });
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

  const { data: inserted, error: insErr } = await supabase
    .from("attendance_corrections")
    .insert({
      company_id: profile.company_id,
      employee_id: user.id,
      target_date: targetDate,
      original_clock_in,
      original_clock_out,
      requested_clock_in: reqIn,
      requested_clock_out: reqOut,
      reason,
      status: "pending",
    })
    .select("*")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, correction: inserted });
}
