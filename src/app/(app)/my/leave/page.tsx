import { LeaveRequestForm } from "@/components/my/leave-request-form";
import { paidLeaveDaysInMonth } from "@/lib/attendance-calendar-build";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  step1_pending: "承認待ち",
  approved: "承認済",
  rejected: "差戻し",
};

export default async function MyLeavePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const { data: leaveBal } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, days_used_ytd, next_accrual_date, next_accrual_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: leavesApproved } = await supabase
    .from("leave_requests")
    .select("start_date, end_date, kind")
    .eq("user_id", user.id)
    .eq("status", "approved");

  const takenThisMonth = paidLeaveDaysInMonth(
    (leavesApproved ?? []) as { start_date: string; end_date: string; kind: string }[],
    y,
    m,
  );

  const { data: requestsRaw } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, kind, status, reason, created_at, reject_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const requests = (requestsRaw ?? []) as {
    id: string;
    start_date: string;
    end_date: string;
    kind: string;
    status: string;
    reason: string | null;
    created_at: string;
    reject_reason: string | null;
  }[];

  const bal = leaveBal as {
    days_remaining?: number;
    days_used_ytd?: number;
    next_accrual_date?: string;
    next_accrual_days?: number;
  } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          有給・休暇
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          残日数・今月の取得・申請状況。カレンダーは勤怠画面から開けます。
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">残日数</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {bal?.days_remaining ?? "—"}
            <span className="ml-1 text-lg font-normal text-zinc-500">日</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            年初来取得: {bal?.days_used_ytd ?? "—"} 日
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            次回付与: {bal?.next_accrual_date ?? "—"}
            {bal?.next_accrual_days != null && `（${bal.next_accrual_days}日）`}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500">今月の取得</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-sky-700 dark:text-sky-400">
            {takenThisMonth}
            <span className="ml-1 text-lg font-normal text-zinc-500">日</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">承認済の休暇のみ集計</p>
          <Link
            href={`/my/attendance/calendar?y=${y}&m=${m}`}
            className="mt-3 inline-block text-sm text-blue-600 underline"
          >
            月次カレンダーを見る →
          </Link>
        </div>
      </section>

      <LeaveRequestForm />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">申請一覧</h2>
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {requests.map((r) => (
            <li key={r.id} className="py-3 text-sm first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium tabular-nums">
                  {r.start_date} 〜 {r.end_date}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.status === "approved"
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                      : r.status === "rejected"
                        ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                  }`}
                >
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {r.kind === "full" ? "全日" : r.kind === "half" ? "半日" : "時間"}
                {r.reason && ` · ${r.reason}`}
              </p>
              {r.reject_reason && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  差戻し理由: {r.reject_reason}
                </p>
              )}
            </li>
          ))}
          {!requests.length && (
            <li className="py-6 text-center text-zinc-500">申請はまだありません</li>
          )}
        </ul>
      </section>
    </div>
  );
}
