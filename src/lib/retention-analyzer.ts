import { createAdminClient } from "@/lib/supabase/admin";
import { pushLineMessage } from "@/lib/line";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";

export type RetentionSeverity = "high" | "medium" | "low";

export type StaffProfile = {
  id: string;
  company_id: string;
  name: string | null;
  is_sales_target: boolean;
};

/** 未解決アラートから 0〜100 のリスクスコア（UI 用） */
export function retentionRiskScoreFromOpenAlerts(
  alerts: { severity: RetentionSeverity }[],
): number {
  let score = 0;
  for (const a of alerts) {
    if (a.severity === "high") score += 34;
    else if (a.severity === "medium") score += 18;
    else score += 8;
  }
  return Math.min(100, score);
}

const HIGH_QUIT = /辞めたい|転職|限界|つらい|やめたい/;
const LOW_CAREER = /評価|給与|将来|キャリア/;

function isoToJstYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function isJstWeekendYmd(ymd: string): boolean {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(new Date(`${ymd}T12:00:00+09:00`));
  const w = parts.find((p) => p.type === "weekday")?.value ?? "";
  return w === "土" || w === "日";
}

function minutesFromMidnightJst(iso: string): number {
  const d = new Date(iso);
  const h = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(d),
    10,
  );
  const mi = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      minute: "2-digit",
    }).format(d),
    10,
  );
  return h * 60 + mi;
}

function stdevSample(values: number[]): number {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v =
    values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function leaveDayWeight(kind: string, start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  const days = Math.max(1, differenceInCalendarDays(e, s) + 1);
  if (kind === "full") return days;
  if (kind === "half") return days * 0.5;
  return Math.max(0.125, days * 0.125);
}

function expandLeaveDates(start: string, end: string): Set<string> {
  const set = new Set<string>();
  const cur = parseISO(start);
  const last = parseISO(end);
  for (let d = cur; d <= last; d = addDays(d, 1)) {
    set.add(format(d, "yyyy-MM-dd"));
  }
  return set;
}

function maxConsecutiveLeaveDays(
  approvedLeaves: { start_date: string; end_date: string; kind: string }[],
): number {
  const days = new Set<string>();
  for (const L of approvedLeaves) {
    if (L.kind === "hour") continue;
    const exp = expandLeaveDates(L.start_date, L.end_date);
    exp.forEach((x) => days.add(x));
  }
  const sorted = [...days].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]!);
    const cur = parseISO(sorted[i]!);
    if (differenceInCalendarDays(cur, prev) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function totalLeaveDaysInRange(
  approvedLeaves: { start_date: string; end_date: string; kind: string }[],
  fromYmd: string,
  toYmd: string,
): number {
  let sum = 0;
  const from = parseISO(fromYmd);
  const to = parseISO(toYmd);
  for (const L of approvedLeaves) {
    const s = parseISO(L.start_date);
    const e = parseISO(L.end_date);
    if (e < from || s > to) continue;
    const overlapStart = s > from ? s : from;
    const overlapEnd = e < to ? e : to;
    const adjStart = format(overlapStart, "yyyy-MM-dd");
    const adjEnd = format(overlapEnd, "yyyy-MM-dd");
    sum += leaveDayWeight(L.kind, adjStart, adjEnd);
  }
  return sum;
}

function employeeIncentiveTotal(
  deals: {
    appo_employee_id: string | null;
    closer_employee_id: string | null;
    appo_incentive: number;
    closer_incentive: number;
    submit_status: string;
  }[],
  uid: string,
): number {
  let t = 0;
  for (const d of deals) {
    if (!["submitted", "approved"].includes(d.submit_status)) continue;
    if (d.appo_employee_id === uid) t += Number(d.appo_incentive) || 0;
    if (d.closer_employee_id === uid) t += Number(d.closer_incentive) || 0;
  }
  return t;
}

function collectUserMessages(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  const out: string[] = [];
  for (const m of messages) {
    if (
      m &&
      typeof m === "object" &&
      (m as { role?: string }).role === "user" &&
      typeof (m as { content?: unknown }).content === "string"
    ) {
      out.push((m as { content: string }).content);
    }
  }
  return out;
}

async function insertAlertIfOpen(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    company_id: string;
    employee_id: string;
    alert_type: string;
    severity: RetentionSeverity;
    message: string;
  },
): Promise<boolean> {
  const { data: existing } = await admin
    .from("retention_alerts")
    .select("id")
    .eq("employee_id", row.employee_id)
    .eq("alert_type", row.alert_type)
    .eq("is_resolved", false)
    .maybeSingle();

  if (existing) return false;

  const { error } = await admin.from("retention_alerts").insert({
    company_id: row.company_id,
    employee_id: row.employee_id,
    alert_type: row.alert_type,
    severity: row.severity,
    message: row.message,
  });
  return !error;
}

async function notifyOwnersLine(
  admin: ReturnType<typeof createAdminClient>,
  text: string,
) {
  const { data: owners } = await admin
    .from("employees")
    .select("line_user_id, name")
    .eq("role", "owner")
    .not("line_user_id", "is", null);

  for (const o of owners ?? []) {
    const id = (o as { line_user_id: string }).line_user_id?.trim();
    if (id) await pushLineMessage(id, text);
  }
}

export async function runRetentionAnalysis(): Promise<{
  ok: boolean;
  alertsCreated: number;
  highRiskLineSent: number;
  skipped?: boolean;
  message?: string;
}> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "admin client error";
    console.warn("[retention]", msg);
    return {
      ok: true,
      alertsCreated: 0,
      highRiskLineSent: 0,
      skipped: true,
      message: msg,
    };
  }

  const now = new Date();
  const curStart = startOfMonth(now);
  const curEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const p2Start = startOfMonth(subMonths(now, 2));
  const p3Start = startOfMonth(subMonths(now, 3));

  const curStartYmd = format(curStart, "yyyy-MM-dd");
  const curEndYmd = format(curEnd, "yyyy-MM-dd");
  const prevStartYmd = format(prevStart, "yyyy-MM-dd");
  const prevEndYmd = format(prevEnd, "yyyy-MM-dd");

  const { data: staff, error: staffErr } = await admin
    .from("employees")
    .select("id, name, company_id, is_sales_target")
    .eq("role", "staff");

  if (staffErr || !staff?.length) {
    return {
      ok: !staffErr,
      alertsCreated: 0,
      highRiskLineSent: 0,
      message: staffErr?.message,
    };
  }

  const userIds = staff.map((s) => s.id as string);
  const sinceIso = subMonths(now, 5).toISOString();

  const [leavesRes, punchesRes, dealsRes, expRes, convoRes, grantsRes, otRes] =
    await Promise.all([
      admin
        .from("leave_requests")
        .select("user_id, start_date, end_date, kind, status")
        .in("user_id", userIds)
        .eq("status", "approved"),
      admin
        .from("attendance_punches")
        .select("user_id, punch_type, punched_at")
        .in("user_id", userIds)
        .gte("punched_at", sinceIso)
        .order("punched_at", { ascending: true }),
      admin
        .from("deals")
        .select(
          "appo_employee_id, closer_employee_id, appo_incentive, closer_incentive, submit_status, year, month",
        )
        .gte("year", now.getFullYear() - 1),
      admin
        .from("expenses")
        .select("submitter_id, category, amount, paid_date, purpose, status, created_at")
        .in("submitter_id", userIds)
        .neq("status", "draft")
        .gte("created_at", sinceIso),
      admin
        .from("hr_conversations")
        .select("employee_id, messages, updated_at")
        .in("employee_id", userIds),
      admin
        .from("paid_leave_grants")
        .select("employee_id, grant_date, days_remaining, days_granted, days_used")
        .in("employee_id", userIds),
      admin
        .from("deemed_ot_records")
        .select("app_user_id, year, month, overtime_hours, excess_hours, allotted_hours")
        .in("app_user_id", userIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
    ]);

  const leavesByUser = new Map<
    string,
    { start_date: string; end_date: string; kind: string }[]
  >();
  for (const r of leavesRes.data ?? []) {
    const row = r as {
      user_id: string;
      start_date: string;
      end_date: string;
      kind: string;
    };
    const list = leavesByUser.get(row.user_id) ?? [];
    list.push({
      start_date: row.start_date,
      end_date: row.end_date,
      kind: row.kind,
    });
    leavesByUser.set(row.user_id, list);
  }

  const punchesByUser = new Map<string, { punch_type: string; punched_at: string }[]>();
  for (const r of punchesRes.data ?? []) {
    const row = r as { user_id: string; punch_type: string; punched_at: string };
    const list = punchesByUser.get(row.user_id) ?? [];
    list.push({ punch_type: row.punch_type, punched_at: row.punched_at });
    punchesByUser.set(row.user_id, list);
  }

  const deals = (dealsRes.data ?? []) as {
    appo_employee_id: string | null;
    closer_employee_id: string | null;
    appo_incentive: number;
    closer_incentive: number;
    submit_status: string;
    year: number;
    month: number;
  }[];

  const expByUser = new Map<string, typeof expRes.data>();
  for (const r of expRes.data ?? []) {
    const row = r as { submitter_id: string };
    const list = expByUser.get(row.submitter_id) ?? [];
    list.push(r);
    expByUser.set(row.submitter_id, list);
  }

  const convoByUser = new Map<string, { messages: unknown }[]>();
  for (const r of convoRes.data ?? []) {
    const row = r as { employee_id: string; messages: unknown };
    const list = convoByUser.get(row.employee_id) ?? [];
    list.push({ messages: row.messages });
    convoByUser.set(row.employee_id, list);
  }

  const grantsByUser = new Map<string, typeof grantsRes.data>();
  for (const r of grantsRes.data ?? []) {
    const row = r as { employee_id: string };
    const list = grantsByUser.get(row.employee_id) ?? [];
    list.push(r);
    grantsByUser.set(row.employee_id, list);
  }

  const otByUser = new Map<string, typeof otRes.data>();
  for (const r of otRes.data ?? []) {
    const row = r as { app_user_id: string };
    const list = otByUser.get(row.app_user_id) ?? [];
    list.push(r);
    otByUser.set(row.app_user_id, list);
  }

  let created = 0;
  let lineSent = 0;
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const ppy = pm === 1 ? py - 1 : py;
  const ppm = pm === 1 ? 12 : pm - 1;

  for (const row of staff) {
    const emp = row as StaffProfile;
    const id = emp.id;
    const companyId = emp.company_id;
    if (!companyId) continue;
    const name = emp.name?.trim() ?? "（氏名未設定）";
    const leaves = leavesByUser.get(id) ?? [];
    const punches = punchesByUser.get(id) ?? [];

    const newAlerts: { severity: RetentionSeverity; type: string; msg: string }[] =
      [];

    // --- High: consecutive leave 5+ ---
    const maxConsec = maxConsecutiveLeaveDays(leaves);
    if (maxConsec >= 5) {
      newAlerts.push({
        severity: "high",
        type: "leave_consecutive_5",
        msg: `${name} さん: 有給等の休暇が連続で ${maxConsec} 日以上取得されています（離職リスクの兆候）。`,
      });
    }

    // --- High: late 3+ or absence 3+ in current month ---
    const leaveDaysSet = new Set<string>();
    for (const L of leaves) {
      expandLeaveDates(L.start_date, L.end_date).forEach((d) => leaveDaysSet.add(d));
    }
    const monthDays = eachDayOfInterval({
      start: parseISO(curStartYmd),
      end: parseISO(curEndYmd),
    }).map((d) => format(d, "yyyy-MM-dd"));

    let lateCount = 0;
    let absenceCount = 0;
    for (const ymd of monthDays) {
      if (isJstWeekendYmd(ymd)) continue;
      const dayPunches = punches.filter((p) => isoToJstYmd(p.punched_at) === ymd);
      dayPunches.sort(
        (a, b) =>
          new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
      );
      const firstIn = dayPunches.find((p) => p.punch_type === "clock_in");
      if (!firstIn) {
        if (!leaveDaysSet.has(ymd)) absenceCount += 1;
        continue;
      }
      const mins = minutesFromMidnightJst(firstIn.punched_at);
      if (mins > 10 * 60) lateCount += 1;
    }
    if (lateCount + absenceCount >= 3) {
      newAlerts.push({
        severity: "high",
        type: "late_absence_3",
        msg: `${name} さん: 今月、遅刻 ${lateCount} 回・欠勤扱い ${absenceCount} 日（平日・未取得休除く）があります。`,
      });
    }

    // --- High: incentive MoM -50% ---
    const dealsCur = deals.filter((d) => d.year === y && d.month === m);
    const dealsPrev = deals.filter((d) => d.year === py && d.month === pm);
    const incCur = employeeIncentiveTotal(dealsCur, id);
    const incPrev = employeeIncentiveTotal(dealsPrev, id);
    if (incPrev > 5000 && incCur <= incPrev * 0.5) {
      newAlerts.push({
        severity: "high",
        type: "incentive_mom_drop_50",
        msg: `${name} さん: インセンティブ試算が前月比 50% 以上減少しています（今月 ${Math.round(incCur)} 円 / 前月 ${Math.round(incPrev)} 円）。`,
      });
    }

    // --- High: sales expense dry 2 months ---
    if (emp.is_sales_target) {
      const exps = expByUser.get(id) ?? [];
      const monthKeyFromExp = (raw: { paid_date?: string; created_at?: string }) => {
        const p = raw.paid_date?.slice(0, 7);
        if (p && /^\d{4}-\d{2}$/.test(p)) return p;
        return raw.created_at?.slice(0, 7) ?? "";
      };
      const countInMonth = (yy: number, mm: number) => {
        const key = `${yy}-${String(mm).padStart(2, "0")}`;
        return exps.filter(
          (e) => monthKeyFromExp(e as { paid_date?: string; created_at?: string }) === key,
        ).length;
      };
      const c1 = countInMonth(py, pm);
      const c2 = countInMonth(ppy, ppm);
      if (c1 === 0 && c2 === 0) {
        newAlerts.push({
          severity: "high",
          type: "sales_expense_dry_2mo",
          msg: `${name} さん（営業）: 経費申請が過去2ヶ月連続で 0 件です。`,
        });
      }
    }

    // --- High: AI quit keywords ---
    const convos = convoByUser.get(id) ?? [];
    let quitHit = false;
    for (const c of convos) {
      for (const msg of collectUserMessages(c.messages)) {
        if (HIGH_QUIT.test(msg)) {
          quitHit = true;
          break;
        }
      }
      if (quitHit) break;
    }
    if (quitHit) {
      newAlerts.push({
        severity: "high",
        type: "ai_quit_keywords",
        msg: `${name} さん: AI 相談で強い離職ニュアンスのキーワードが検知されました。`,
      });
    }

    // --- Medium: leave surge 200% MoM ---
    const leaveCur = totalLeaveDaysInRange(leaves, curStartYmd, curEndYmd);
    const leavePrev = totalLeaveDaysInRange(leaves, prevStartYmd, prevEndYmd);
    if (leavePrev >= 0.5 && leaveCur >= leavePrev * 2) {
      newAlerts.push({
        severity: "medium",
        type: "leave_surge_mom_200",
        msg: `${name} さん: 有給等の取得日数が先月比 200% 以上に急増しています。`,
      });
    }

    // --- Medium: OT / work hours MoM -50% from deemed_ot_records ---
    const otRows = otByUser.get(id) ?? [];
    const otCur = otRows.find((r) => (r as { year: number }).year === y && (r as { month: number }).month === m) as
      | { overtime_hours: number | null; total_work_hours?: number | null }
      | undefined;
    const otP = otRows.find(
      (r) => (r as { year: number }).year === py && (r as { month: number }).month === pm,
    ) as { overtime_hours: number | null; total_work_hours?: number | null } | undefined;
    const hrs = (o: typeof otCur) =>
      Number(o?.total_work_hours ?? o?.overtime_hours ?? 0);
    const hCur = hrs(otCur);
    const hPrev = hrs(otP);
    if (hPrev >= 10 && hCur <= hPrev * 0.5) {
      newAlerts.push({
        severity: "medium",
        type: "ot_mom_drop_50",
        msg: `${name} さん: 残業・労働時間系の集計が先月比 50% 以上減少しています（freee 同期データ）。`,
      });
    }

    // --- Medium: incentive 3-month decline ---
    const dealsP2 = deals.filter((d) => d.year === ppy && d.month === ppm);
    const incP2 = employeeIncentiveTotal(dealsP2, id);
    if (incCur > 0 && incP2 > incPrev && incPrev > incCur) {
      newAlerts.push({
        severity: "medium",
        type: "incentive_3mo_decline",
        msg: `${name} さん: インセンティブが 3 ヶ月連続で減少傾向です。`,
      });
    }

    // --- Medium: punch time volatility ---
    const recentP = punches.filter((p) => {
      const t = new Date(p.punched_at).getTime();
      return t >= subMonths(now, 1).getTime();
    });
    const byDay = new Map<string, { punch_type: string; punched_at: string }[]>();
    for (const p of recentP) {
      const dk = isoToJstYmd(p.punched_at);
      const arr = byDay.get(dk) ?? [];
      arr.push(p);
      byDay.set(dk, arr);
    }
    const firstInMinutes: number[] = [];
    for (const [, list] of byDay) {
      list.sort(
        (a, b) =>
          new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
      );
      const firstIn = list.find((p) => p.punch_type === "clock_in");
      if (firstIn) firstInMinutes.push(minutesFromMidnightJst(firstIn.punched_at));
    }
    if (firstInMinutes.length >= 8 && stdevSample(firstInMinutes) >= 90) {
      newAlerts.push({
        severity: "medium",
        type: "punch_time_volatile",
        msg: `${name} さん: 出勤打刻時刻のばらつきが大きいです（生活リズム変化の可能性）。`,
      });
    }

    // --- Medium: transport / taxi expense surge 2nd half of month ---
    const expsAll = expByUser.get(id) ?? [];
    const isTransportish = (e: Record<string, unknown>) => {
      const cat = String(e.category ?? "");
      const purp = String(e.purpose ?? "");
      return (
        cat.includes("交通") ||
        cat.includes("タクシー") ||
        /タクシー|交通費/u.test(purp)
      );
    };
    const thisMonthEx = expsAll.filter((raw) => {
      const e = raw as { paid_date?: string };
      const p = e.paid_date?.slice(0, 7);
      const key = `${y}-${String(m).padStart(2, "0")}`;
      return p === key && isTransportish(raw as Record<string, unknown>);
    });
    let firstHalf = 0;
    let secondHalf = 0;
    for (const raw of thisMonthEx) {
      const e = raw as { paid_date?: string; amount?: number };
      const day = Number(e.paid_date?.slice(8, 10) ?? 0);
      const amt = Number(e.amount) || 0;
      if (day <= 15) firstHalf += amt;
      else secondHalf += amt;
    }
    if (
      firstHalf > 0 &&
      secondHalf >= firstHalf * 2 &&
      secondHalf >= 3000
    ) {
      newAlerts.push({
        severity: "medium",
        type: "transport_expense_late_surge",
        msg: `${name} さん: 今月後半に交通・タクシー系経費が前半比で急増しています。`,
      });
    }

    // --- Low: paid leave granted but barely used for 6+ months ---
    for (const g of grantsByUser.get(id) ?? []) {
      const gr = g as {
        grant_date: string;
        days_granted: number;
        days_remaining: number;
      };
      const granted = Number(gr.days_granted) || 0;
      const rem = Number(gr.days_remaining) || 0;
      if (granted < 1) continue;
      const ratio = rem / granted;
      const monthsSince =
        (now.getTime() - parseISO(gr.grant_date).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 6 && ratio >= 0.85) {
        newAlerts.push({
          severity: "low",
          type: "paid_leave_hoarding",
          msg: `${name} さん: 付与から6ヶ月近く経過も有給取得が少ない可能性があります（残 ${rem} / 付与 ${granted}）。`,
        });
        break;
      }
    }

    // --- Low: deemed OT excess 3 consecutive months (直近3ヶ月) ---
    const otPick = (yy: number, mm: number) =>
      otRows.find(
        (r) => (r as { year: number }).year === yy && (r as { month: number }).month === mm,
      ) as { excess_hours: number | null } | undefined;
    const otM0 = otPick(y, m);
    const otM1 = otPick(py, pm);
    const otM2 = otPick(ppy, ppm);
    if (
      otM0 &&
      otM1 &&
      otM2 &&
      [otM0, otM1, otM2].every((x) => Number(x.excess_hours ?? 0) > 0)
    ) {
      newAlerts.push({
        severity: "low",
        type: "deemed_ot_excess_3mo",
        msg: `${name} さん: みなし残業の超過が直近3ヶ月連続で発生しています（freee 同期）。`,
      });
    }

    // --- Low: AI career / comp keywords multiple times ---
    let careerHits = 0;
    for (const c of convos) {
      for (const msg of collectUserMessages(c.messages)) {
        const n = (msg.match(LOW_CAREER) ?? []).length;
        if (n > 0) careerHits += 1;
      }
    }
    if (careerHits >= 3) {
      newAlerts.push({
        severity: "low",
        type: "ai_career_keywords",
        msg: `${name} さん: AI 相談で評価・給与・キャリア系の話題が複数回見られます。`,
      });
    }

    for (const a of newAlerts) {
      const inserted = await insertAlertIfOpen(admin, {
        company_id: companyId,
        employee_id: id,
        alert_type: a.type,
        severity: a.severity,
        message: a.msg,
      });
      if (inserted) {
        created += 1;
        if (a.severity === "high") {
          await notifyOwnersLine(
            admin,
            `【LENARD HR・高リスク】退職兆候アラート\n${a.msg}\nダッシュボードでご確認ください。`,
          );
          lineSent += 1;
        }
      }
    }
  }

  return { ok: true, alertsCreated: created, highRiskLineSent: lineSent };
}