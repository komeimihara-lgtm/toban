import type { SupabaseClient } from "@supabase/supabase-js";

/** 勤続月数ベースの法定有給日数（対象日時点の「年間付与日数」最小枠） */
export const PAID_LEAVE_MILESTONE_MONTHS = [
  6, 18, 30, 42, 54, 66, 78,
] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function daysInMonthJst(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** YYYY-MM-DD（入社日など）から n ヶ月後の暦日（JST として解釈） */
export function addCalendarMonthsFromYmd(ymd: string, monthsToAdd: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const total = m - 1 + monthsToAdd;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const dim = daysInMonthJst(ny, nm + 1);
  const dd = Math.min(d, dim);
  return new Date(
    `${ny}-${pad2(nm + 1)}-${pad2(dd)}T12:00:00+09:00`,
  );
}

export function ymdJst(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

/** hireDate / targetDate は同一タイムゾーン比較（JST YMD 基準） */
export function calcPaidLeaveDays(startDate: Date, targetDate: Date): number {
  if (targetDate.getTime() < startDate.getTime()) return 0;
  const hireYmd = ymdJst(startDate);
  const targetYmd = ymdJst(targetDate);
  const [hy, hm, hd] = hireYmd.split("-").map(Number);
  const [ty, tm, td] = targetYmd.split("-").map(Number);
  let months = (ty - hy) * 12 + (tm - hm);
  if (td < hd) months -= 1;
  if (months < 6) return 0;
  if (months < 18) return 10;
  if (months < 30) return 11;
  if (months < 42) return 12;
  if (months < 54) return 14;
  if (months < 66) return 16;
  if (months < 78) return 18;
  return 20;
}

/** 次回の付与（未到来の最初のマイルストーン日）。全て過ぎていれば null */
export function getNextGrantDate(startDate: Date): Date | null {
  const startStr = ymdJst(startDate);
  const todayStr = ymdJst(new Date());
  for (const mo of PAID_LEAVE_MILESTONE_MONTHS) {
    const d = addCalendarMonthsFromYmd(startStr, mo);
    const ds = ymdJst(d);
    if (ds > todayStr) return d;
  }
  return null;
}

/** 次回マイルストーンで付与される増分日数（法定の段階差分） */
export function nextMilestoneGrantDelta(
  startDate: Date,
): { date: Date; delta: number } | null {
  const next = getNextGrantDate(startDate);
  if (!next) return null;
  const startStr = ymdJst(startDate);
  const hireRef = new Date(`${startStr}T12:00:00+09:00`);
  const nextTotal = calcPaidLeaveDays(hireRef, next);
  let prevTotal = 0;
  for (const mo of PAID_LEAVE_MILESTONE_MONTHS) {
    const g = addCalendarMonthsFromYmd(startStr, mo);
    if (ymdJst(g) < ymdJst(next)) {
      prevTotal = calcPaidLeaveDays(hireRef, g);
    }
  }
  return { date: next, delta: nextTotal - prevTotal };
}

export function plannedGrantDaysAtNextMilestone(startDate: Date): number | null {
  return nextMilestoneGrantDelta(startDate)?.delta ?? null;
}

type GrantNotify = {
  company_id: string;
  employee_id: string;
  line_user_id: string | null;
  full_name: string | null;
  grant_date: string;
  days_granted: number;
};

/** 付与日が本日以前のマイルストーンで未付与なら INSERT（service_role クライアント想定） */
export async function checkAndGrantPaidLeave(
  admin: SupabaseClient,
  params: {
    employeeId: string;
    companyId: string;
    startDateYmd: string;
  },
): Promise<{ granted: number; notifications: GrantNotify[] }> {
  const todayStr = ymdJst(new Date());
  const startStr = params.startDateYmd;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
    return { granted: 0, notifications: [] };
  }

  const notifications: GrantNotify[] = [];
  let prevStatutoryTotal = 0;
  let granted = 0;
  const hireDate = new Date(`${startStr}T12:00:00+09:00`);

  for (const mo of PAID_LEAVE_MILESTONE_MONTHS) {
    const grantMoment = addCalendarMonthsFromYmd(startStr, mo);
    const grantYmd = ymdJst(grantMoment);
    if (grantYmd > todayStr) break;

    const { data: existing } = await admin
      .from("paid_leave_grants")
      .select("id")
      .eq("employee_id", params.employeeId)
      .eq("grant_date", grantYmd)
      .limit(1);

    const curStatutory = calcPaidLeaveDays(hireDate, grantMoment);
    if (existing?.length) {
      prevStatutoryTotal = curStatutory;
      continue;
    }
    const delta = curStatutory - prevStatutoryTotal;
    if (delta <= 0) {
      prevStatutoryTotal = curStatutory;
      continue;
    }

    const reason = mo === 6 ? "initial" : "anniversary";
    const expiresMoment = addCalendarMonthsFromYmd(grantYmd, 24);
    const expiresYmd = ymdJst(expiresMoment);

    const { error } = await admin.from("paid_leave_grants").insert({
      employee_id: params.employeeId,
      company_id: params.companyId,
      grant_date: grantYmd,
      days_granted: delta,
      days_used: 0,
      days_remaining: delta,
      grant_reason: reason,
      expires_at: expiresYmd,
    });

    if (error) {
      console.error("paid_leave_grants insert:", error.message);
      continue;
    }

    prevStatutoryTotal = curStatutory;
    granted += 1;

    const { data: prof } = await admin
      .from("profiles")
      .select("line_user_id, full_name")
      .eq("id", params.employeeId)
      .maybeSingle();

    notifications.push({
      company_id: params.companyId,
      employee_id: params.employeeId,
      line_user_id: (prof as { line_user_id?: string | null })?.line_user_id ?? null,
      full_name: (prof as { full_name?: string | null })?.full_name ?? null,
      grant_date: grantYmd,
      days_granted: delta,
    });
  }

  return { granted, notifications };
}
