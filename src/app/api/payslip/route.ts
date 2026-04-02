import { calcDeemedOt } from "@/lib/deemed-ot";
import { getFreeeAccessToken } from "@/lib/freee-access";
import {
  fetchPayroll,
  fetchWorkSummary,
  type PayrollStatement,
} from "@/lib/freee-hr";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

function payrollToCacheRow(
  freeeCompanyId: string,
  appUserId: string,
  year: number,
  month: number,
  p: PayrollStatement,
) {
  return {
    freee_company_id: freeeCompanyId,
    app_user_id: appUserId,
    year,
    month,
    pay_date: p.pay_date || null,
    base_salary: p.base_salary,
    overtime_pay: p.excess_overtime_pay,
    commuting_fee: p.commuting_allowance,
    fixed_ot_pay: p.fixed_overtime_pay,
    total_payment: p.total_payment_amount,
    health_ins: p.health_insurance_amount,
    pension: p.welfare_pension_amount,
    employment_ins: p.employment_insurance_amount,
    income_tax: p.income_tax_amount,
    resident_tax: p.inhabitant_tax_amount,
    total_deduction: p.total_deduction_amount,
    net_payment: p.net_payment_amount,
    freee_stmt_id: p.id,
    raw_json: p as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID が未設定です" },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("freee_employee_id")
    .eq("id", user.id)
    .maybeSingle();

  const freeeEmpId = profile?.freee_employee_id as number | null | undefined;
  if (freeeEmpId == null) {
    return Response.json({
      ok: false,
      needs_mapping: true,
      error: "profiles.freee_employee_id が未設定です（管理者が freee の従業員IDを登録してください）",
    });
  }

  const token = await getFreeeAccessToken(freeeCompanyId);
  if (!token) {
    return Response.json({
      ok: false,
      needs_oauth: true,
      error: "freee が未連携です。連携リンクから認証してください。",
    });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json(
      { ok: false, error: "サーバー設定（SERVICE_ROLE）が不足しています" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const year = Number(
    url.searchParams.get("year") ?? new Date().getFullYear(),
  );
  const month = Number(
    url.searchParams.get("month") ?? new Date().getMonth() + 1,
  );

  const companyIdNum = Number(freeeCompanyId);
  if (!Number.isFinite(companyIdNum)) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID は数値の会社IDを指定してください" },
      { status: 503 },
    );
  }

  const deemedConfig = await loadDeemedOtSettings(
    admin,
    freeeCompanyId,
    user.id,
  );

  try {
    const [summary, payroll] = await Promise.all([
      fetchWorkSummary(token, companyIdNum, freeeEmpId, year, month),
      fetchPayroll(token, companyIdNum, freeeEmpId, year, month),
    ]);

    const deemedOt = calcDeemedOt(summary, deemedConfig);

    await admin.from("deemed_ot_records").upsert(
      {
        freee_company_id: freeeCompanyId,
        app_user_id: user.id,
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
      {
        onConflict: "freee_company_id,app_user_id,year,month",
      },
    );

    if (payroll) {
      await admin.from("payslip_cache").upsert(
        payrollToCacheRow(freeeCompanyId, user.id, year, month, payroll),
        { onConflict: "freee_company_id,app_user_id,year,month" },
      );
    }

    return Response.json({
      ok: true,
      year,
      month,
      payroll,
      deemed_ot: deemedOt,
      paid_leave: {
        used_days: summary.paid_holiday_used_days,
        remaining_days: summary.paid_holiday_remaining_days,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "freee api error";
    console.error("[api/payslip]", e);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
