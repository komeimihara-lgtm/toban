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
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">黄金ルール評価表</h2>
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
              <li key={s.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                {/* ヘッダー */}
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-card">
                  <div>
                    <p className="text-sm font-medium">{empName || "—"}</p>
                    <p className="text-xs text-zinc-500">{s.year}年{s.month}月 · {SHEET_LABEL[sheetType]}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>自己: <span className="font-bold">{selfTotal}</span>/{maxScore} (×{getMultiplier(sheetType, selfTotal).toFixed(1)})</p>
                    <p>上司: <span className="font-bold">{mgrTotal}</span>/{maxScore} (×{getMultiplier(sheetType, mgrTotal).toFixed(1)})</p>
                  </div>
                </div>

                {/* 項目 */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {categories.map((cat) => (
                    <div key={cat.name}>
                      <div className="bg-accent/5 px-4 py-1.5 dark:bg-accent/10">
                        <p className="text-xs font-bold text-accent">【{cat.name}】</p>
                      </div>
                      {cat.indices.map((idx) => {
                        const ci = items[idx];
                        const selfEntry = s.self_check?.find((c) => c.item === ci.item);
                        const selfVal = selfEntry?.score ?? 0;
                        const mgrVal = getScore(s.id, idx, selfVal);
                        return (
                          <div key={idx} className="px-4 py-2.5">
                            <p className="mb-1.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                              <span className="mr-1 text-zinc-400">{idx + 1}.</span>
                              {ci.item}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              {/* 自己評価（読み取り専用） */}
                              <div className="flex items-center gap-1.5">
                                <span className="w-8 text-[10px] font-medium text-zinc-400">自己</span>
                                <span className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold ${
                                  selfVal > 0
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                }`}>
                                  {selfVal > 0 ? "+" : ""}{selfVal}
                                </span>
                              </div>
                              {/* 上司評価ボタン */}
                              <div className="flex items-center gap-1.5">
                                <span className="w-8 text-[10px] font-medium text-zinc-400">上司</span>
                                <div className="flex gap-0.5">
                                  {SCORE_OPTIONS.map((o) => (
                                    <button
                                      key={o.value}
                                      onClick={() => setScore(s.id, idx, o.value)}
                                      className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                                        mgrVal === o.value
                                          ? o.value > 0 ? "bg-accent text-white" : "bg-red-500 text-white"
                                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-card/80 dark:text-zinc-400"
                                      }`}
                                    >
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* 提出ボタン */}
                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-card">
                  <div className="text-xs text-zinc-500">
                    上司評価合計: <span className="font-bold text-zinc-800 dark:text-zinc-200">{mgrTotal}</span>/{maxScore}
                    （×{getMultiplier(sheetType, mgrTotal).toFixed(1)}）
                  </div>
                  <button
                    onClick={() => submitManagerCheck(s.id, empName)}
                    disabled={loading === s.id}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
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
