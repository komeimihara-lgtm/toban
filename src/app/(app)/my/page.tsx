import { InterviewInviteBanner } from "@/components/my/interview-invite-banner";
import { PunchButtons } from "@/components/attendance/punch-buttons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { summarizePunchesInRange } from "@/lib/attendance-summary";
import { isIncentiveEligible as elig } from "@/types/incentive";
import type { ProfileRow } from "@/types/incentive";
import { startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function todayPunchStatus(
  rows: { punch_type: string; punched_at: string }[],
): { label: string; detail: string } {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
  );
  let lastIn: string | null = null;
  let lastOut: string | null = null;
  for (const r of sorted) {
    if (r.punch_type === "clock_in") lastIn = r.punched_at;
    if (r.punch_type === "clock_out") lastOut = r.punched_at;
  }
  if (!lastIn) {
    return { label: "未出勤", detail: "まだ今日の出勤打刻がありません。" };
  }
  const inTime = new Date(lastIn).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
  if (!lastOut || new Date(lastOut) < new Date(lastIn)) {
    return {
      label: "勤務中",
      detail: `出勤 ${inTime} · 退勤打刻がまだありません`,
    };
  }
  const outTime = new Date(lastOut).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
  return {
    label: "退勤済み",
    detail: `出勤 ${inTime} · 退勤 ${outTime}`,
  };
}

export default async function MyHomePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empProfile } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const p = empProfile as ProfileRow | null;

  const dayStart = startOfDay(new Date()).toISOString();
  const { data: todayPunchesRaw } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", dayStart)
    .order("punched_at", { ascending: true });

  const todayPunches = (todayPunchesRaw ?? []) as {
    punch_type: string;
    punched_at: string;
  }[];
  const punchStatus = todayPunchStatus(todayPunches);

  const { data: leaveBal } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, next_accrual_date, next_accrual_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const nowYm = new Date();
  const yMonth = nowYm.getFullYear();
  const mMonth = nowYm.getMonth() + 1;

  const { data: monthlyGoalRow } = p?.id
    ? await supabase
        .from("monthly_goals")
        .select("*")
        .eq("employee_id", p.id)
        .eq("year", yMonth)
        .eq("month", mMonth)
        .maybeSingle()
    : { data: null };

  type MonthlyGoalKpi = {
    name?: string;
    target?: string;
    unit?: string;
    actual?: string;
  };
  type MonthlyGoalRow = {
    theme?: string;
    kpis?: MonthlyGoalKpi[] | null;
    result_input?: { kpi_results?: { actual?: string }[] } | null;
  };
  const monthlyGoal = monthlyGoalRow as MonthlyGoalRow | null;

  function parseGoalKpiNumber(v: unknown): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "")
      .trim()
      .replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  const goalKpiDisplay =
    monthlyGoal?.kpis?.map((kpi, i) => {
      const rawResult =
        monthlyGoal.result_input?.kpi_results?.[i]?.actual ?? kpi.actual;
      return {
        name: kpi.name?.trim() || `KPI ${i + 1}`,
        unit: kpi.unit ?? "",
        result: parseGoalKpiNumber(rawResult),
        target: parseGoalKpiNumber(kpi.target),
      };
    }) ?? [];

  const monthStartIso = new Date(yMonth, mMonth - 1, 1).toISOString();
  const nextMonthStartIso = new Date(yMonth, mMonth, 1).toISOString();

  const { data: pendingExpRows } = await supabase
    .from("expenses")
    .select("amount, status")
    .eq("submitter_id", user.id)
    .in("status", ["step1_pending", "step2_pending"])
    .gte("created_at", monthStartIso)
    .lt("created_at", nextMonthStartIso);

  const pendingList = pendingExpRows ?? [];
  const pendingCount = pendingList.length;
  const pendingSum = pendingList.reduce(
    (a, e) => a + Number((e as { amount: number }).amount),
    0,
  );

  const { data: payslipThisMonth } = await supabase
    .from("payslip_cache")
    .select("year, month, net_payment, pay_date")
    .eq("app_user_id", user.id)
    .eq("year", yMonth)
    .eq("month", mMonth)
    .maybeSingle();

  let psRow = payslipThisMonth as {
    year: number;
    month: number;
    net_payment: number | null;
    pay_date: string | null;
  } | null;
  let payslipIsCurrentMonth = Boolean(psRow);

  if (!psRow) {
    const { data: lastPayslip } = await supabase
      .from("payslip_cache")
      .select("year, month, net_payment, pay_date")
      .eq("app_user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    psRow = lastPayslip as typeof psRow;
    payslipIsCurrentMonth = false;
  }

  const { data: interviewReq } = await supabase
    .from("ai_interview_requests")
    .select("id")
    .eq("employee_id", user.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let incentivePreview: string | null = null;
  if (p && elig(p)) {
    const { data: dealRows } = await supabase
      .from("deals")
      .select(
        "appo_incentive, closer_incentive, submit_status, appo_employee_id, closer_employee_id",
      )
      .eq("year", yMonth)
      .eq("month", mMonth)
      .or(`appo_employee_id.eq.${user.id},closer_employee_id.eq.${user.id}`);
    let sum = 0;
    for (const raw of dealRows ?? []) {
      const d = raw as {
        appo_incentive: number;
        closer_incentive: number;
        submit_status: string;
        appo_employee_id: string | null;
        closer_employee_id: string | null;
      };
      if (d.submit_status === "rejected") continue;
      if (d.appo_employee_id === user.id) sum += Number(d.appo_incentive) || 0;
      if (d.closer_employee_id === user.id) sum += Number(d.closer_incentive) || 0;
    }
    incentivePreview = new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(Math.floor(sum));
  }

  type NoticeRow = { at: string; text: string; href: string };
  const noticeRows: NoticeRow[] = [];
  const { data: expNews } = await supabase
    .from("expenses")
    .select("id, status, updated_at, purpose, category")
    .eq("submitter_id", user.id)
    .in("status", ["approved", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(20);
  for (const raw of expNews ?? []) {
    const er = raw as {
      status: string;
      updated_at: string;
      purpose: string;
      category: string;
    };
    const title = [er.category, er.purpose].filter(Boolean).join(" · ").slice(0, 40);
    if (er.status === "approved") {
      noticeRows.push({
        at: er.updated_at,
        text: `経費が承認されました（${title || "詳細は一覧へ"}）`,
        href: "/my/expenses",
      });
    } else {
      noticeRows.push({
        at: er.updated_at,
        text: `経費が差戻しされました（${title || "詳細は一覧へ"}）`,
        href: "/my/expenses",
      });
    }
  }
  const { data: dealNews } = await supabase
    .from("deals")
    .select("id, submit_status, updated_at, salon_name, machine_type")
    .or(`appo_employee_id.eq.${user.id},closer_employee_id.eq.${user.id}`)
    .in("submit_status", ["approved", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(20);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: grantNews } = await supabase
    .from("paid_leave_grants")
    .select("grant_date, days_granted, grant_reason, created_at")
    .eq("employee_id", user.id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(15);
  for (const raw of grantNews ?? []) {
    const gr = raw as {
      grant_date: string;
      days_granted: number;
      grant_reason: string;
      created_at: string;
    };
    noticeRows.push({
      at: gr.created_at,
      text: `有給が ${Number(gr.days_granted)} 日付与されました（付与日 ${gr.grant_date}・${gr.grant_reason}）`,
      href: "/my/leave",
    });
  }

  for (const raw of dealNews ?? []) {
    const dr = raw as {
      submit_status: string;
      updated_at: string;
      salon_name: string;
      machine_type: string;
    };
    const label = [dr.salon_name, dr.machine_type].filter(Boolean).join(" · ").slice(0, 36);
    if (dr.submit_status === "approved") {
      noticeRows.push({
        at: dr.updated_at,
        text: `案件インセンティブが承認されました（${label || "詳細へ"}）`,
        href: "/my/incentive",
      });
    } else {
      noticeRows.push({
        at: dr.updated_at,
        text: `案件が差戻しされました（${label || "詳細へ"}）`,
        href: "/my/incentive",
      });
    }
  }
  noticeRows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const notices = noticeRows.slice(0, 15);

  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }
  const monthPunchStart = `${yMonth}-${pad2(mMonth)}-01T00:00:00+09:00`;
  const nextM = mMonth === 12 ? 1 : mMonth + 1;
  const nextY = mMonth === 12 ? yMonth + 1 : yMonth;
  const monthPunchEnd = `${nextY}-${pad2(nextM)}-01T00:00:00+09:00`;
  const { data: monthPunchRows } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", monthPunchStart)
    .lt("punched_at", monthPunchEnd)
    .order("punched_at", { ascending: true });
  const monthSummary = summarizePunchesInRange(monthPunchRows ?? [], { now: nowYm });
  const fmtHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}時間${m}分`;
  };

  const yen = (n: number) =>
    new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          マイページ
        </h1>
      </div>

      {interviewReq && (
        <InterviewInviteBanner requestId={(interviewReq as { id: string }).id} />
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
        <div>
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            今日の打刻
          </h2>
          <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {punchStatus.label}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{punchStatus.detail}</p>
        </div>
        <div className="mt-4">
          <PunchButtons />
        </div>
      </section>

      {monthlyGoal ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">今月の目標</h2>
            <Link
              href="/my/goals"
              className="text-xs text-blue-400 hover:underline"
            >
              詳細 →
            </Link>
          </div>
          <p className="mt-2 text-base font-medium text-zinc-100">
            {monthlyGoal.theme?.trim() || "（テーマ未入力）"}
          </p>
          {goalKpiDisplay.map((kpi, idx) => {
            const pct =
              kpi.target > 0
                ? Math.min(100, (kpi.result / kpi.target) * 100)
                : 0;
            return (
              <div key={`${kpi.name}-${idx}`} className="mt-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{kpi.name}</span>
                  <span className="tabular-nums">
                    {kpi.result} / {kpi.target}
                    {kpi.unit}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-700 p-4 text-center">
          <p className="text-sm text-zinc-500">今月の目標が未設定です</p>
          <Link
            href="/my/goals"
            className="mt-2 inline-block text-xs text-blue-400 hover:underline"
          >
            目標を設定する →
          </Link>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            有給残日数・次回付与日
          </h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {(leaveBal as { days_remaining?: number } | null)?.days_remaining ?? "—"}
            <span className="ml-1 text-base font-normal text-zinc-600 dark:text-zinc-400">
              日
            </span>
          </p>
          <Link
            href="/my/leave"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600/30 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
          >
            有給・休暇の詳細 →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            今月の承認待ち経費
          </h2>
          <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {pendingCount} 件 · {yen(pendingSum)}
          </p>
          <Link
            href="/my/expenses"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600/30 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
          >
            経費一覧へ →
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {payslipIsCurrentMonth ? "今月の給与明細（サマリー）" : "給与明細サマリー（直近）"}
        </h2>
        {!payslipIsCurrentMonth && psRow ? (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            今月分は未同期のため、最新の明細を表示しています。
          </p>
        ) : null}
        {psRow ? (
          <>
            <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              手取り{" "}
              {psRow.net_payment != null ? yen(psRow.net_payment) : "—"}
              <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">
                {psRow.year}年{psRow.month}月分
              </span>
            </p>
            {psRow.pay_date && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                支払日 <span className="tabular-nums">{psRow.pay_date}</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            まだ同期された明細がありません。
          </p>
        )}
        <Link
          href="/my/payslip"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600/30 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
        >
          給与明細の詳細へ →
        </Link>
      </section>

      {incentivePreview != null && p && elig(p) && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            今月のインセンティブ試算（案件）
          </h2>
          <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            {incentivePreview}
          </p>
          <Link
            href="/my/incentive"
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600/30 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
          >
            入力・履歴へ →
          </Link>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">お知らせ</h2>
        {notices.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            直近の承認・差戻し・有給付与の通知はありません。
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
            {notices.map((n, i) => (
              <li key={`${n.at}-${i}`}>
                <Link
                  href={n.href}
                  className="font-medium text-blue-600 underline underline-offset-2 hover:no-underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {n.text}
                </Link>
                <span className="ml-2 tabular-nums text-xs text-zinc-600 dark:text-zinc-400">
                  {new Date(n.at).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          今月の勤務時間サマリー
        </h2>
        <p className="mt-2 text-xs text-zinc-500">※ 休憩控除済み</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">出勤日数</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {monthSummary.workDays} 日
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">総労働時間</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {fmtHM(monthSummary.totalWorkMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">超過（8h/日基準）</dt>
            <dd className="text-lg font-semibold tabular-nums text-amber-800 dark:text-amber-300">
              {fmtHM(monthSummary.overtimeMinutes)}
            </dd>
          </div>
        </dl>
        <Link
          href="/my/attendance"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600/30 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
        >
          勤怠の詳細へ →
        </Link>
      </section>

      <div>
        <Link
          href="/hr-ai"
          className="inline-flex w-full items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40 sm:w-auto"
        >
          ✦ AI人事チャットを開く
        </Link>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          規程・手続きの案内にご利用ください
        </p>
      </div>
    </div>
  );
}
