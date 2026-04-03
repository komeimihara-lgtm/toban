"use client";

import { useState } from "react";
import {
  getItems,
  getMaxScore,
  getMultiplier,
  SCORE_OPTIONS,
  SHEET_LABEL,
  type SheetType,
} from "./sheet-definitions";

type CheckEntry = { category: string; item: string; score: number };
type Sheet = {
  id: string;
  self_check: CheckEntry[];
  manager_check: CheckEntry[];
  status: string;
};

export function CheckSheetClient({
  currentSheet,
  year,
  month,
  sheetType,
}: {
  currentSheet: Sheet | null;
  year: number;
  month: number;
  sheetType: SheetType;
  employeeName: string;
}) {
  const items = getItems(sheetType);
  const maxScore = getMaxScore(sheetType);

  const [sheet, setSheet] = useState<Sheet | null>(currentSheet);
  const [selfScores, setSelfScores] = useState<(number | null)[]>(() =>
    items.map((ci) => {
      const found = sheet?.self_check?.find((c) => c.item === ci.item);
      return found?.score ?? null;
    })
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const isSubmitted = sheet?.status === "submitted" || sheet?.status === "reviewed";
  const total = selfScores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
  const multiplier = getMultiplier(sheetType, total);
  const allAnswered = selfScores.every((s) => s !== null);

  // カテゴリごとにグルーピング
  const categories: { name: string; indices: number[] }[] = [];
  items.forEach((ci, i) => {
    const last = categories[categories.length - 1];
    if (last && last.name === ci.category) {
      last.indices.push(i);
    } else {
      categories.push({ name: ci.category, indices: [i] });
    }
  });

  // 上司評価
  const managerTotal = sheet?.manager_check?.length
    ? sheet.manager_check.reduce((sum, c) => sum + c.score, 0)
    : null;
  const managerMultiplier = managerTotal != null ? getMultiplier(sheetType, managerTotal) : null;

  async function submitCheck() {
    setSaving(true);
    try {
      const self_check = items.map((ci, i) => ({
        category: ci.category,
        item: ci.item,
        score: selfScores[i] ?? 0,
      }));
      const res = await fetch("/api/check-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, self_check }),
      });
      if (!res.ok) { showToast("提出に失敗しました"); return; }
      const { sheet: saved } = await res.json();
      setSheet(saved);
      showToast("提出しました");
    } catch { showToast("提出に失敗しました"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          {SHEET_LABEL[sheetType]}
        </span>
        <span className="text-xs text-zinc-500">{year}年{month}月</span>
        {sheet && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            sheet.status === "reviewed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : sheet.status === "submitted"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            {sheet.status === "reviewed" ? "評価完了" : sheet.status === "submitted" ? "提出済み" : "下書き"}
          </span>
        )}
      </div>

      {/* 評価基準 */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <span className="font-medium">評価基準：</span>
        {SCORE_OPTIONS.map((o) => (
          <span key={o.value} className="ml-3">
            <span className="font-bold">{o.label}</span>
            <span className="text-zinc-500"> {o.desc}</span>
          </span>
        ))}
      </div>

      {/* カテゴリごとの評価セクション */}
      {categories.map((cat) => (
        <section key={cat.name} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-accent">{cat.name}</h2>
          <div className="mt-3 space-y-3">
            {cat.indices.map((idx) => {
              const ci = items[idx];
              const mEntry = sheet?.manager_check?.find((c) => c.item === ci.item);
              return (
                <div key={idx} className="space-y-1.5">
                  <p className="text-sm leading-snug">{ci.item}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-12 text-xs text-zinc-500">自己:</span>
                    <div className="flex gap-1">
                      {SCORE_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => {
                            if (isSubmitted) return;
                            const next = [...selfScores];
                            next[idx] = o.value;
                            setSelfScores(next);
                          }}
                          disabled={isSubmitted}
                          className={`flex h-8 w-10 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                            selfScores[idx] === o.value
                              ? o.value > 0
                                ? "bg-accent text-white"
                                : "bg-red-500 text-white"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                          } disabled:cursor-default`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {mEntry && (
                      <>
                        <span className="ml-4 w-12 text-xs text-zinc-500">上司:</span>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          mEntry.score > 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {mEntry.score > 0 ? "+" : ""}{mEntry.score}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* 合計・倍率 */}
      <section className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5 dark:border-accent/20 dark:bg-accent/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">自己評価 合計</p>
            <p className="text-3xl font-bold tabular-nums">
              {total}
              <span className="text-base font-normal text-zinc-500"> / {maxScore}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">インセンティブ倍率</p>
            <p className={`text-3xl font-bold tabular-nums ${
              multiplier > 1.0 ? "text-emerald-600 dark:text-emerald-400"
              : multiplier < 1.0 ? "text-red-600 dark:text-red-400"
              : ""
            }`}>
              ×{multiplier.toFixed(1)}
            </p>
          </div>
          {managerTotal != null && (
            <>
              <div>
                <p className="text-xs text-zinc-500">上司評価 合計</p>
                <p className="text-2xl font-bold tabular-nums">
                  {managerTotal}
                  <span className="text-base font-normal text-zinc-500"> / {maxScore}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">上司倍率</p>
                <p className={`text-2xl font-bold tabular-nums ${
                  managerMultiplier! > 1.0 ? "text-emerald-600 dark:text-emerald-400"
                  : managerMultiplier! < 1.0 ? "text-red-600 dark:text-red-400"
                  : ""
                }`}>
                  ×{managerMultiplier!.toFixed(1)}
                </p>
              </div>
            </>
          )}
        </div>
        {!isSubmitted && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={submitCheck}
              disabled={saving || !allAnswered}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "提出中..." : !allAnswered ? "全項目を入力してください" : "提出する"}
            </button>
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </>
  );
}
