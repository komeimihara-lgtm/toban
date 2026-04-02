import { InterviewInviteBanner } from "@/components/my/interview-invite-banner";
import { PunchButtons } from "@/components/attendance/punch-buttons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isIncentiveEligible as elig } from "@/types/incentive";
import type { ProfileRow } from "@/types/incentive";
import { startOfDay } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function ym() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as ProfileRow | null;

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

  const { data: pendingExpRows } = await supabase
    .from("expenses")
    .select("amount, status")
    .eq("submitter_id", user.id)
    .in("status", ["step1_pending", "step2_pending"]);

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
    .maybeSingle();

  let incentivePreview: string | null = null;
  if (p && elig(p)) {
    const y = ym();
    const { data: rateR } = await supabase
      .from("incentive_rates")
      .select("rate")
      .eq("user_id", user.id)
      .eq("year_month", y)
      .maybeSingle();
    const { data: sub } = await supabase
      .from("incentive_submissions")
      .select("sales_amount, rate_snapshot, status")
      .eq("user_id", user.id)
      .eq("year_month", y)
      .maybeSingle();
    const r = rateR ? Number(rateR.rate) : 0;
    const base = sub?.sales_amount != null ? Number(sub.sales_amount) : null;
    const rs = sub?.rate_snapshot != null ? Number(sub.rate_snapshot) : r;
    if (base != null && rs) {
      incentivePreview = new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
      }).format(Math.floor(base * rs));
    } else if (rs) {
      incentivePreview = `率 ${(rs * 100).toFixed(2)}%（実績入力後に試算）`;
    }
  }

  const yen = (n: number) =>
    new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          マイページ
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          個人ダッシュボード — 自分のデータのみ表示されます
        </p>
      </div>

      {interviewReq && (
        <InterviewInviteBanner requestId={(interviewReq as { id: string }).id} />
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">今日の打刻</h2>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {punchStatus.label}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{punchStatus.detail}</p>
          </div>
          <Link
            href="/my/attendance"
            className="shrink-0 text-sm font-medium text-blue-600 underline dark:text-blue-400"
          >
            勤怠へ →
          </Link>
        </div>
        <div className="mt-4">
          <PunchButtons />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">有給残日数</h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {(leaveBal as { days_remaining?: number } | null)?.days_remaining ?? "—"}
            <span className="ml-1 text-base font-normal text-zinc-500">日</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            次回付与:{" "}
            {(leaveBal as { next_accrual_date?: string } | null)?.next_accrual_date ?? "—"}
            {((leaveBal as { next_accrual_days?: number } | null)?.next_accrual_days != null) &&
              `（${(leaveBal as { next_accrual_days: number }).next_accrual_days}日）`}
          </p>
          <Link href="/my/leave" className="mt-3 inline-block text-sm text-blue-600 underline">
            有給・休暇の詳細 →
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">承認待ちの経費</h2>
          <p className="mt-2 text-lg font-semibold tabular-nums">
            {pendingCount} 件 · {yen(pendingSum)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            第1・最終承認待ち（下書きは含みません）
          </p>
          <Link href="/my/expenses" className="mt-3 inline-block text-sm text-blue-600 underline">
            経費一覧へ
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">
          {payslipIsCurrentMonth ? "今月の給与明細（サマリー）" : "給与明細サマリー（直近）"}
        </h2>
        {!payslipIsCurrentMonth && psRow ? (
          <p className="mt-1 text-xs text-zinc-500">
            今月分は未同期のため、最新の明細を表示しています。
          </p>
        ) : null}
        {psRow ? (
          <>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              手取り{" "}
              {psRow.net_payment != null ? yen(psRow.net_payment) : "—"}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {psRow.year}年{psRow.month}月分
              </span>
            </p>
            {psRow.pay_date && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                支払日 <span className="tabular-nums">{psRow.pay_date}</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">まだ同期された明細がありません。</p>
        )}
        <Link href="/my/payslip" className="mt-3 inline-block text-sm text-blue-600 underline">
          給与明細の詳細へ
        </Link>
      </section>

      {incentivePreview && p && elig(p) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">今月のインセンティブ試算</h2>
          <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            {incentivePreview}
          </p>
          <Link href="/my/incentive" className="mt-2 inline-block text-sm text-blue-600 underline">
            入力・履歴へ
          </Link>
        </section>
      )}

      <div>
        <Link
          href="/hr-ai"
          className="inline-flex w-full items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40 sm:w-auto"
        >
          ✦ AI人事チャットを開く
        </Link>
        <p className="mt-2 text-xs text-zinc-500">規程・手続きの案内にご利用ください</p>
      </div>
    </div>
  );
}
