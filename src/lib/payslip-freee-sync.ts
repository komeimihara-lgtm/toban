import { calcDeemedOt } from "@/lib/deemed-ot";
import {
  fetchPayroll,
  fetchWorkSummary,
  type PayrollStatement,
} from "@/lib/freee-hr";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function loadDeemedOtSettings(
  admin: Admin,
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

export function payrollToCacheRow(
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

/** 1名分: 勤怠サマリー・みなし残業・給与明細を取得して Supabase に保存 */
export async function syncPayslipAndDeemedForUser(
  admin: Admin,
  token: string,
  companyIdNum: number,
  freeeCompanyId: string,
  appUserId: string,
  freeeEmpId: number,
  year: number,
  month: number,
) {
  const deemedConfig = await loadDeemedOtSettings(
    admin,
    freeeCompanyId,
    appUserId,
  );

  const [summary, payroll] = await Promise.all([
    fetchWorkSummary(token, companyIdNum, freeeEmpId, year, month),
    fetchPayroll(token, companyIdNum, freeeEmpId, year, month),
  ]);

  const deemedOt = calcDeemedOt(summary, deemedConfig);

  await admin.from("deemed_ot_records").upsert(
    {
      freee_company_id: freeeCompanyId,
      app_user_id: appUserId,
      year,
      month,
      overtime_hours: deemedOt.actual_hours,
      late_night_hours: deemedOt.late_night_hours,
      holiday_work_hours: deemedOt.holiday_hours,
      total_work_hours: Math.round((summary.total_work_time / 60) * 10) / 10,
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

  if (payroll) {
    await admin.from("payslip_cache").upsert(
      payrollToCacheRow(freeeCompanyId, appUserId, year, month, payroll),
      { onConflict: "freee_company_id,app_user_id,year,month" },
    );
  }

  return {
    deemed_ot: deemedOt,
    payroll,
    paid_leave: {
      used_days: summary.paid_holiday_used_days,
      remaining_days: summary.paid_holiday_remaining_days,
    },
  };
}

export type StaffSyncResult = {
  user_id: string;
  name: string | null;
  ok?: boolean;
  error?: string;
  payroll_id?: number;
};

/** freee_employee_id がある全プロフィールを対象に一括同期（Cron / 管理API 用） */
export async function syncAllProfilesPayslipAndDeemed(
  admin: Admin,
  token: string,
  companyIdNum: number,
  freeeCompanyId: string,
  year: number,
  month: number,
): Promise<StaffSyncResult[]> {
  const { data: profiles, error: listErr } = await admin
    .from("profiles")
    .select("id, freee_employee_id, full_name")
    .not("freee_employee_id", "is", null);

  if (listErr) {
    throw new Error(listErr.message);
  }

  const results: StaffSyncResult[] = [];

  for (const row of profiles ?? []) {
    const uid = (row as { id: string }).id;
    const empId = Number((row as { freee_employee_id: number }).freee_employee_id);
    const name = (row as { full_name: string | null }).full_name;
    if (!Number.isFinite(empId)) {
      results.push({ user_id: uid, name, error: "freee_employee_id が不正" });
      continue;
    }

    try {
      const out = await syncPayslipAndDeemedForUser(
        admin,
        token,
        companyIdNum,
        freeeCompanyId,
        uid,
        empId,
        year,
        month,
      );
      results.push({
        user_id: uid,
        name,
        ok: true,
        payroll_id: out.payroll?.id,
      });
    } catch (e) {
      results.push({
        user_id: uid,
        name,
        error: e instanceof Error ? e.message : "sync error",
      });
    }
  }

  return results;
}
