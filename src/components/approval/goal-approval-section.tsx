"use client";

import { useState } from "react";

type GoalRow = {
  id: string; year: number; month: number; theme: string;
  employee_id: string; status: string;
};

export function GoalApprovalSection({
  goals: initialGoals,
  nameMap,
}: {
  goals: GoalRow[];
  nameMap: Record<string, string>;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoading(id);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reject_reason: action === "reject" ? rejectReason[id] : undefined,
        }),
      });
      if (!res.ok) { showToast("操作に失敗しました"); return; }
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showToast(action === "approve" ? "承認しました" : "差戻ししました");
    } catch { showToast("操作に失敗しました"); }
    finally { setLoading(null); }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">月間目標</h2>
      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500">承認待ちはありません</p>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <li key={g.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium">{nameMap[g.employee_id] ?? "—"}</p>
              <p className="mt-1 text-sm">{g.year}年{g.month}月</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{g.theme}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction(g.id, "approve")}
                  disabled={loading === g.id}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  承認
                </button>
                <input
                  value={rejectReason[g.id] ?? ""}
                  onChange={(e) => setRejectReason({ ...rejectReason, [g.id]: e.target.value })}
                  className="rounded border px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="差戻し理由"
                />
                <button
                  onClick={() => handleAction(g.id, "reject")}
                  disabled={loading === g.id || !rejectReason[g.id]?.trim()}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  差戻し
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </section>
  );
}
