"use client";

import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

type Employee = {
  id: string;
  resignation_date: string | null;
  last_working_date: string | null;
  offboarding_status: string;
  scheduled_auth_deactivation_date: string | null;
} | null;

export function OffboardingPageClient() {
  const [employee, setEmployee] = useState<Employee>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [paidLeave, setPaidLeave] = useState<number | null>(null);
  const [monthlyHint, setMonthlyHint] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/offboarding");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "読み込み失敗");
      setEmployee(j.employee ?? null);
      setTasks(j.tasks ?? []);
      setPaidLeave(
        typeof j.paid_leave_days_remaining === "number"
          ? j.paid_leave_days_remaining
          : null,
      );
      setMonthlyHint(
        typeof j.monthly_contract_hint === "number" ? j.monthly_contract_hint : null,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(id: string) {
    setBusyTask(id);
    try {
      const res = await fetch(`/api/offboarding/tasks/${id}/complete`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "更新に失敗しました");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusyTask(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  if (!employee || employee.offboarding_status !== "offboarding") {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        退社手続きは人事から開始されるまで表示されません。ご不明点は管理本部へお問い合わせください。
      </p>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  const leavePayEstimate =
    paidLeave != null && monthlyHint != null
      ? Math.round((monthlyHint / 22) * paidLeave)
      : null;

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {message}
        </p>
      )}

      <section className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-zinc-500">退職日</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {employee.resignation_date ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">最終出勤日</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {employee.last_working_date ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">アカウント無効化予定日</p>
          <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
            {employee.scheduled_auth_deactivation_date ?? "（人事がスケジュール設定後に表示）"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          有給・最終給与の参考（試算）
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          法定通りの計算ではありません。月22営業日換算の概算です。正確な金額は給与担当までお問い合わせください。
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">有給残（日）</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {paidLeave != null ? paidLeave : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">契約上の基本月額（参考）</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {monthlyHint != null
                ? `¥${monthlyHint.toLocaleString("ja-JP")}`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">有給買取相当の粗い目安（日給×残日）</dt>
            <dd className="font-medium tabular-nums text-amber-800 dark:text-amber-200">
              {leavePayEstimate != null
                ? `¥${leavePayEstimate.toLocaleString("ja-JP")}`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            進捗
          </h2>
          <span className="text-sm font-semibold tabular-nums">
            {completedCount} / {tasks.length}（{progress}%）
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-amber-600 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          タスク
        </h2>
        <ul className="space-y-3">
          {tasks.map((t) => {
            const done = t.status === "completed";
            return (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {done ? "✓ " : ""}
                      {t.title}
                    </p>
                    {t.description ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {t.description}
                      </p>
                    ) : null}
                  </div>
                  {!done ? (
                    <button
                      type="button"
                      disabled={busyTask === t.id}
                      onClick={() => void completeTask(t.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {busyTask === t.id ? "処理中…" : "完了にする"}
                    </button>
                  ) : (
                    <span className="text-sm text-emerald-600">完了</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
