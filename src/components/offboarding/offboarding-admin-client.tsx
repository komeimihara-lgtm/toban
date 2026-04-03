"use client";

import { useState } from "react";

export type OffboardingAdminRow = {
  employee_record_id: string;
  user_id: string;
  full_name: string | null;
  resignation_date: string | null;
  last_working_date: string | null;
  offboarding_status: string;
  scheduled_auth_deactivation_date: string | null;
  task_total: number;
  task_done: number;
};

export function OffboardingAdminClient({
  initialRows,
  candidateEmployees,
}: {
  initialRows: OffboardingAdminRow[];
  candidateEmployees: { id: string; full_name: string | null }[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [empId, setEmpId] = useState("");
  const [resignDate, setResignDate] = useState("");
  const [lastWork, setLastWork] = useState("");

  async function startOffboarding(e: React.FormEvent) {
    e.preventDefault();
    if (!empId || !resignDate || !lastWork) {
      setMsg("全項目を入力してください");
      return;
    }
    setBusy("start");
    setMsg(null);
    try {
      const res = await fetch("/api/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: empId,
          resignation_date: resignDate,
          last_working_date: lastWork,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "作成に失敗しました");
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(null);
    }
  }

  async function scheduleDeactivate(employeeRecordId: string) {
    setBusy(employeeRecordId);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/offboarding/${employeeRecordId}/schedule-deactivation`,
        { method: "POST" },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "設定に失敗しました");
      setMsg(`無効化予定日: ${j.scheduled_auth_deactivation_date ?? ""}`);
      setRows((prev) =>
        prev.map((r) =>
          r.employee_record_id === employeeRecordId
            ? {
                ...r,
                scheduled_auth_deactivation_date:
                  j.scheduled_auth_deactivation_date ?? r.scheduled_auth_deactivation_date,
              }
            : r,
        ),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {msg && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{msg}</p>
      )}

      <form
        onSubmit={startOffboarding}
        className="max-w-xl space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          退社手続きを開始
        </h2>
        <div>
          <label className="text-xs text-zinc-500">従業員レコード</label>
          <select
            required
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-card"
          >
            <option value="">選択してください</option>
            {candidateEmployees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.id.slice(0, 8)} ({c.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">退職日</label>
          <input
            type="date"
            required
            value={resignDate}
            onChange={(e) => setResignDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-card"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">最終出勤日</label>
          <input
            type="date"
            required
            value={lastWork}
            onChange={(e) => setLastWork(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-card"
          />
        </div>
        <button
          type="submit"
          disabled={busy === "start"}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy === "start" ? "処理中…" : "タスク一括作成"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:bg-card">
            <tr>
              <th className="px-4 py-2">氏名</th>
              <th className="px-4 py-2">ステータス</th>
              <th className="px-4 py-2">タスク</th>
              <th className="px-4 py-2">無効化予定</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const complete =
                r.task_total > 0 && r.task_done >= r.task_total && r.offboarding_status === "offboarding";
              return (
                <tr
                  key={r.employee_record_id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    {r.full_name ?? r.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.offboarding_status}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.task_done} / {r.task_total}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.scheduled_auth_deactivation_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.offboarding_status === "offboarding" ? (
                      <div className="flex flex-col items-end gap-1">
                        {complete ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            退社手続き完了（タスク）
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy === r.employee_record_id}
                          onClick={() => void scheduleDeactivate(r.employee_record_id)}
                          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          無効化をスケジュール
                        </button>
                      </div>
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
