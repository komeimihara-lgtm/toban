"use client";

import { useState } from "react";

const CHECK_ITEMS = [
  "出勤率・遅刻なし",
  "報連相の徹底",
  "顧客満足度",
  "チームワーク",
  "目標達成への取り組み姿勢",
  "スキルアップへの取り組み",
  "会社理念の体現",
];

type SheetRow = {
  id: string; year: number; month: number;
  employee_id: string; self_check: { item: string; score: number }[];
  status: string;
};

export function CheckSheetApprovalSection({
  sheets: initialSheets,
  nameMap,
}: {
  sheets: SheetRow[];
  nameMap: Record<string, string>;
}) {
  const [sheets, setSheets] = useState(initialSheets);
  const [loading, setLoading] = useState<string | null>(null);
  const [managerScores, setManagerScores] = useState<Record<string, number[]>>({});
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function getScores(id: string): number[] {
    return managerScores[id] ?? CHECK_ITEMS.map(() => 3);
  }

  async function submitManagerCheck(id: string) {
    setLoading(id);
    try {
      const scores = getScores(id);
      const manager_check = CHECK_ITEMS.map((item, i) => ({ item, score: scores[i] }));
      const res = await fetch("/api/check-sheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, manager_check }),
      });
      if (!res.ok) { showToast("評価に失敗しました"); return; }
      setSheets((prev) => prev.filter((s) => s.id !== id));
      showToast("評価を保存しました");
    } catch { showToast("評価に失敗しました"); }
    finally { setLoading(null); }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">チェックシート評価</h2>
      {sheets.length === 0 ? (
        <p className="text-sm text-zinc-500">評価待ちはありません</p>
      ) : (
        <ul className="space-y-6">
          {sheets.map((s) => {
            const scores = getScores(s.id);
            return (
              <li key={s.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{nameMap[s.employee_id] ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{s.year}年{s.month}月</p>
                </div>
                <div className="mt-3 space-y-2">
                  {CHECK_ITEMS.map((item, i) => {
                    const selfEntry = s.self_check?.find((c) => c.item === item);
                    return (
                      <div key={item} className="flex items-center justify-between gap-3">
                        <span className="flex-1 text-xs">{item}</span>
                        <span className="text-xs text-zinc-500">自己: {selfEntry?.score ?? "—"}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((sc) => (
                            <button
                              key={sc}
                              onClick={() => {
                                const next = [...scores];
                                next[i] = sc;
                                setManagerScores({ ...managerScores, [s.id]: next });
                              }}
                              className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium ${
                                scores[i] === sc
                                  ? "bg-accent text-white"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {sc}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => submitManagerCheck(s.id)}
                    disabled={loading === s.id}
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {loading === s.id ? "保存中..." : "上司評価を保存"}
                  </button>
                </div>
              </li>
            );
          })}
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
