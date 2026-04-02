import { createAdminClient } from "@/lib/supabase/admin";
import { differenceInCalendarDays } from "date-fns";

const ALERT_TYPE = "attendance_gap";
/** 最終打刻からこの日数以上空いたスタッフにアラート */
const MEDIUM_DAYS = 4;
const HIGH_DAYS = 7;

export async function runRetentionAnalysis(): Promise<{
  ok: boolean;
  alertsCreated: number;
  skipped?: boolean;
  message?: string;
}> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "admin client error";
    console.warn("[retention]", msg);
    return { ok: true, alertsCreated: 0, skipped: true, message: msg };
  }

  const { data: staff, error: staffErr } = await admin
    .from("profiles")
    .select("id, full_name, company_id")
    .eq("role", "staff");

  if (staffErr || !staff?.length) {
    return {
      ok: !staffErr,
      alertsCreated: 0,
      message: staffErr?.message,
    };
  }

  let created = 0;
  const now = new Date();

  for (const row of staff) {
    const id = row.id as string;
    const companyId = row.company_id as string | null;
    if (!companyId) continue;
    const name = (row.full_name as string | null)?.trim() ?? "（氏名未設定）";

    const { data: lastPunch } = await admin
      .from("attendance_punches")
      .select("punched_at")
      .eq("user_id", id)
      .order("punched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastAt = lastPunch?.punched_at
      ? new Date(lastPunch.punched_at as string)
      : null;
    const daysGap = lastAt
      ? differenceInCalendarDays(now, lastAt)
      : HIGH_DAYS + 1;

    let severity: "high" | "medium" | null = null;
    if (daysGap >= HIGH_DAYS) severity = "high";
    else if (daysGap >= MEDIUM_DAYS) severity = "medium";

    if (!severity) continue;

    const { data: existing } = await admin
      .from("retention_alerts")
      .select("id")
      .eq("employee_id", id)
      .eq("alert_type", ALERT_TYPE)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existing) continue;

    const message =
      lastAt == null
        ? `${name} さん: 打刻履歴がありません。フォローを検討してください。`
        : `${name} さん: 最終打刻から ${daysGap} 日経過しています。`;

    const { error: insErr } = await admin.from("retention_alerts").insert({
      company_id: companyId,
      employee_id: id,
      alert_type: ALERT_TYPE,
      severity,
      message,
    });

    if (!insErr) created += 1;
  }

  return { ok: true, alertsCreated: created };
}
