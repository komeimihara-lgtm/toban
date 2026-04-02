"use client";

import { useState } from "react";

export type OnboardingAdminRow = {
  employee_record_id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  task_total: number;
  task_done: number;
};

export function OnboardingAdminClient({
  initialRows,
}: {
  initialRows: OnboardingAdminRow[];
}) {
  const [rows] = useState(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function remind(userId: string) {
    setBusy(userId);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "送信に失敗しました");
      setMsg("リマインドをキューに追加しました。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-2">氏名</th>
              <th className="px-4 py-2">入社レコード作成</th>
              <th className="px-4 py-2">タスク</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct =
                r.task_total > 0 ? Math.round((r.task_done / r.task_total) * 100) : 0;
              const complete = r.task_total > 0 && r.task_done >= r.task_total;
              return (
                <tr
                  key={r.employee_record_id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {r.full_name ?? r.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {r.task_done} / {r.task_total}
                  </td>
                  <td className="px-4 py-3">
                    {complete ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        入社手続き完了
                      </span>
                    ) : (
                      <span className="text-zinc-500">{pct}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!complete && r.task_total > 0 ? (
                      <button
                        type="button"
                        disabled={busy === r.user_id}
                        onClick={() => void remind(r.user_id)}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        {busy === r.user_id ? "送信中…" : "リマインド"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
