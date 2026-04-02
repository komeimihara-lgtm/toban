import { InterviewInviteBanner } from "@/components/my/interview-invite-banner";
import { PunchButtons } from "@/components/attendance/punch-buttons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isIncentiveEligible as elig } from "@/types/incentive";
import type { ProfileRow } from "@/types/incentive";
import { startOfDay } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ym() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MyHomePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as ProfileRow | null;

  const dayStart = startOfDay(new Date()).toISOString();
  const { data: todayPunches } = await supabase
    .from("attendance_punches")
    .select("punch_type, punched_at")
    .eq("user_id", user.id)
    .gte("punched_at", dayStart)
    .order("punched_at", { ascending: true });

  const { data: leaveBal } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, next_accrual_date, next_accrual_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: pendingExp } = await supabase
    .from("expense_claims")
    .select("amount")
    .eq("user_id", user.id)
    .in("status", ["step1_pending", "draft"]);

  const pendingCount = pendingExp?.length ?? 0;
  const pendingSum =
    pendingExp?.reduce((a, r) => a + Number((r as { amount: number }).amount), 0) ??
    0;

  const { data: notifs } = await supabase
    .from("app_notifications")
    .select("id, title, body, created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(8);

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
    const base =
      sub?.sales_amount != null
        ? Number(sub.sales_amount)
        : null;
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

  const { data: monthPunches } = await supabase
    .from("attendance_punches")
    .select("punched_at, punch_type")
    .eq("user_id", user.id)
    .gte("punched_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  const workPairs = (monthPunches ?? []).length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        ホーム
      </h1>

      {interviewReq && (
        <InterviewInviteBanner requestId={(interviewReq as { id: string }).id} />
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">今日の打刻</h2>
        <ul className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {(todayPunches ?? []).map((row) => (
            <li key={(row as { punched_at: string }).punched_at}>
              {(row as { punch_type: string }).punch_type === "clock_in"
                ? "出勤"
                : "退勤"}{" "}
              — {new Date((row as { punched_at: string }).punched_at).toLocaleTimeString("ja-JP")}
            </li>
          ))}
          {!todayPunches?.length && (
            <li className="text-zinc-500">まだ打刻がありません</li>
          )}
        </ul>
        <div className="mt-3">
          <PunchButtons />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">有給</h2>
          <p className="mt-2 text-lg font-semibold">
            残 {(leaveBal as { days_remaining?: number } | null)?.days_remaining ?? "—"}{" "}
            日
          </p>
          <p className="text-xs text-zinc-500">
            次回付与:{" "}
            {(leaveBal as { next_accrual_date?: string } | null)?.next_accrual_date ??
              "—"}
            {((leaveBal as { next_accrual_days?: number } | null)?.next_accrual_days != null) &&
              `（${(leaveBal as { next_accrual_days: number }).next_accrual_days}日）`}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">今月の承認待ち経費</h2>
          <p className="mt-2 text-lg font-semibold">{pendingCount} 件</p>
          <p className="text-sm text-zinc-600">
            {new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(pendingSum)}
          </p>
        </div>
      </section>

      {incentivePreview && p && elig(p) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">インセンティブ試算</h2>
          <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            {incentivePreview}
          </p>
          <Link
            href="/my/incentive"
            className="mt-2 inline-block text-sm text-blue-600 underline"
          >
            入力画面へ
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">今月の勤務（打刻件数）</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{workPairs}</p>
        <p className="text-xs text-zinc-500">打刻レコード数（概算サマリー）</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">お知らせ</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(notifs ?? []).map((n) => (
            <li key={(n as { id: string }).id} className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <span className="font-medium">{(n as { title: string }).title}</span>
              <p className="text-zinc-600">{(n as { body: string | null }).body}</p>
            </li>
          ))}
          {!notifs?.length && (
            <li className="text-zinc-500">新しい通知はありません</li>
          )}
        </ul>
      </section>

      <Link
        href="/hr-ai"
        className="inline-flex rounded-xl border border-zinc-300 bg-zinc-50 px-5 py-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
      >
        AI相談窓口を開く →
      </Link>
    </div>
  );
}
