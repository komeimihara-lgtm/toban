import { PunchButtons } from "@/components/attendance/punch-buttons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { summarizePunchesInRange } from "@/lib/attendance-summary";
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

  const nowYm = new Date();
  const yMonth = nowYm.getFullYear();
  const mMonth = nowYm.getMonth() + 1;
  const dayStart = startOfDay(new Date()).toISOString();

  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }
  const monthPunchStart = `${yMonth}-${pad2(mMonth)}-01T00:00:00+09:00`;
  const nextM = mMonth === 12 ? 1 : mMonth + 1;
  const nextY = mMonth === 12 ? yMonth + 1 : yMonth;
  const monthPunchEnd = `${nextY}-${pad2(nextM)}-01T00:00:00+09:00`;

  const [{ data: todayPunchesRaw }, { data: monthPunchRows }] =
    await Promise.all([
      supabase
        .from("attendance_punches")
        .select("punch_type, punched_at")
        .eq("user_id", user.id)
        .gte("punched_at", dayStart)
        .order("punched_at", { ascending: true }),
      supabase
        .from("attendance_punches")
        .select("punch_type, punched_at")
        .eq("user_id", user.id)
        .gte("punched_at", monthPunchStart)
        .lt("punched_at", monthPunchEnd)
        .order("punched_at", { ascending: true }),
    ]);

  const todayPunches = (todayPunchesRaw ?? []) as {
    punch_type: string;
    punched_at: string;
  }[];
  const punchStatus = todayPunchStatus(todayPunches);

  const monthSummary = summarizePunchesInRange(monthPunchRows ?? [], { now: nowYm });
  const fmtHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}時間${m}分`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          マイページ
        </h1>
      </div>

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
    </div>
  );
}
