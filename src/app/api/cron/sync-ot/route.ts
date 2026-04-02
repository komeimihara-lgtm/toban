import { calcDeemedOt } from "@/lib/deemed-ot";
import { getFreeeAccessToken } from "@/lib/freee-access";
import { fetchWorkSummary } from "@/lib/freee-hr";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function loadDeemedOtSettings(
  admin: ReturnType<typeof createAdminClient>,
  freeeCompanyId: string,
  appUserId: string,
) {
  const { data: personal } = await admin
    .from("deemed_ot_settings")
    .select("allotted_hours, monthly_amount, alert_pct")
    .eq("freee_company_id", freeeCompanyId)
    .eq("app_user_id", appUserId)
    .maybeSingle();

  if (personal) {
    return {
      allotted_hours: Number(personal.allotted_hours ?? 30),
      monthly_amount: Number(personal.monthly_amount ?? 60000),
      alert_pct: Number(personal.alert_pct ?? 80),
    };
  }

  const { data: companyDefault } = await admin
    .from("deemed_ot_settings")
    .select("allotted_hours, monthly_amount, alert_pct")
    .eq("freee_company_id", freeeCompanyId)
    .is("app_user_id", null)
    .maybeSingle();

  return {
    allotted_hours: Number(companyDefault?.allotted_hours ?? 30),
    monthly_amount: Number(companyDefault?.monthly_amount ?? 60000),
    alert_pct: Number(companyDefault?.alert_pct ?? 80),
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json({ ok: false, error: "FREEE_COMPANY_ID 未設定" }, { status: 503 });
  }

  const companyIdNum = Number(freeeCompanyId);
  if (!Number.isFinite(companyIdNum)) {
    return Response.json({ ok: false, error: "会社IDが不正" }, { status: 503 });
  }

  const token = await getFreeeAccessToken(freeeCompanyId);
  if (!token) {
    return Response.json({ ok: false, error: "freee トークンなし" }, { status: 503 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ ok: false, error: "SERVICE_ROLE 未設定" }, { status: 503 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: profiles, error: listErr } = await admin
    .from("profiles")
    .select("id, freee_employee_id, full_name")
    .not("freee_employee_id", "is", null);

  if (listErr) {
    return Response.json({ ok: false, error: listErr.message }, { status: 500 });
  }

  const results: {
    user_id: string;
    status?: string;
    pct?: number;
    error?: string;
  }[] = [];

  for (const row of profiles ?? []) {
    const uid = (row as { id: string }).id;
    const empId = (row as { freee_employee_id: number }).freee_employee_id;

    try {
      const cfg = await loadDeemedOtSettings(admin, freeeCompanyId, uid);
      const summary = await fetchWorkSummary(
        token,
        companyIdNum,
        empId,
        year,
        month,
      );
      const deemedOt = calcDeemedOt(summary, cfg);

      await admin.from("deemed_ot_records").upsert(
        {
          freee_company_id: freeeCompanyId,
          app_user_id: uid,
          year,
          month,
          overtime_hours: deemedOt.actual_hours,
          late_night_hours: deemedOt.late_night_hours,
          holiday_work_hours: deemedOt.holiday_hours,
          total_work_hours:
            Math.round((summary.total_work_time / 60) * 10) / 10,
          allotted_hours: deemedOt.allotted_hours,
          monthly_amount: deemedOt.monthly_amount,
          excess_hours: deemedOt.excess_hours,
          excess_pay: deemedOt.excess_pay,
          consumption_pct: deemedOt.consumption_pct,
          status: deemedOt.status,
          freee_synced_at: new Date().toISOString(),
        },
        { onConflict: "freee_company_id,app_user_id,year,month" },
      );

      results.push({
        user_id: uid,
        status: deemedOt.status,
        pct: deemedOt.consumption_pct,
      });
    } catch (e) {
      results.push({
        user_id: uid,
        error: e instanceof Error ? e.message : "err",
      });
    }
  }

  return Response.json({ ok: true, year, month, results });
}
