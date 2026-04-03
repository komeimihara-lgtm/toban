"use client";

import { useState } from "react";
import {
  getSheetType,
  getItems,
  getMultiplier,
  getMaxScore,
  SCORE_OPTIONS,
  SHEET_LABEL,
} from "@/app/(app)/my/check-sheet/sheet-definitions";

type CheckEntry = { category: string; item: string; score: number };
type SheetRow = {
  id: string; year: number; month: number;
  employee_id: string; self_check: CheckEntry[];
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
  const [managerScores, setManagerScores] = useState<Record<string, Record<number, number>>>({});
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function getScore(sheetId: string, idx: number, defaultVal: number): number {
    return managerScores[sheetId]?.[idx] ?? defaultVal;
  }

  function setScore(sheetId: string, idx: number, val: number) {
    setManagerScores((prev) => ({
      ...prev,
      [sheetId]: { ...(prev[sheetId] ?? {}), [idx]: val },
    }));
  }

  async function submitManagerCheck(sheetId: string, empName: string) {
    setLoading(sheetId);
    try {
      const sheetType = getSheetType(empName);
      const items = getItems(sheetType);
      const s = sheets.find((x) => x.id === sheetId);
      const manager_check = items.map((ci, i) => ({
        category: ci.category,
        item: ci.item,
        score: getScore(sheetId, i, s?.self_check?.find((c) => c.item === ci.item)?.score ?? 0),
      }));
      const res = await fetch("/api/check-sheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheetId, manager_check }),
      });
      if (!res.ok) { showToast("評価に失敗しました"); return; }
      setSheets((prev) => prev.filter((x) => x.id !== sheetId));
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
            const empName = nameMap[s.employee_id] ?? "";
            const sheetType = getSheetType(empName);
            const items = getItems(sheetType);
            const maxScore = getMaxScore(sheetType);

            // カテゴリグルーピング
            const categories: { name: string; indices: number[] }[] = [];
            items.forEach((ci, i) => {
              const last = categories[categories.length - 1];
              if (last && last.name === ci.category) {
                last.indices.push(i);
              } else {
                categories.push({ name: ci.category, indices: [i] });
              }
            });

            const selfTotal = s.self_check?.reduce((sum, c) => sum + c.score, 0) ?? 0;
            const mgrTotal = items.reduce((sum, ci, i) => {
              return sum + getScore(s.id, i, s.self_check?.find((c) => c.item === ci.item)?.score ?? 0);
            }, 0);

            return (
              <li key={s.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{empName || "—"}</p>
                    <p className="text-xs text-zinc-500">{s.year}年{s.month}月 · {SHEET_LABEL[sheetType]}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>自己: <span className="font-bold">{selfTotal}</span>/{maxScore} (×{getMultiplier(sheetType, selfTotal).toFixed(1)})</p>
                    <p>上司: <span className="font-bold">{mgrTotal}</span>/{maxScore} (×{getMultiplier(sheetType, mgrTotal).toFixed(1)})</p>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {categories.map((cat) => (
                    <div key={cat.name}>
                      <p className="text-xs font-bold text-accent">{cat.name}</p>
                      {cat.indices.map((idx) => {
                        const ci = items[idx];
                        const selfEntry = s.self_check?.find((c) => c.item === ci.item);
                        const selfVal = selfEntry?.score ?? 0;
                        const mgrVal = getScore(s.id, idx, selfVal);
                        return (
                          <div key={idx} className="mt-1.5 space-y-1">
                            <p className="text-xs leading-snug text-zinc-700 dark:text-zinc-300">{ci.item}</p>
                            <div className="flex items-center gap-2">
                              <span className="w-16 text-[10px] text-zinc-500">自己: {selfVal > 0 ? "+" : ""}{selfVal}</span>
                              <span className="text-[10px] text-zinc-500">上司:</span>
                              <div className="flex gap-0.5">
                                {SCORE_OPTIONS.map((o) => (
                                  <button
                                    key={o.value}
                                    onClick={() => setScore(s.id, idx, o.value)}
                                    className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold ${
                                      mgrVal === o.value
                                        ? o.value > 0 ? "bg-accent text-white" : "bg-red-500 text-white"
                                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                                    }`}
                                  >
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => submitManagerCheck(s.id, empName)}
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
