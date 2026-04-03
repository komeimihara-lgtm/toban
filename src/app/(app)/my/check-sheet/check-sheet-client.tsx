"use client";

import { useState } from "react";
import {
  getItems,
  getMaxScore,
  getMultiplier,
  getMultiplierTable,
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
  const multiplierTable = getMultiplierTable(sheetType);

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
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          {SHEET_LABEL[sheetType]}
        </span>
        <span className="text-sm font-medium">{year}年{month}月</span>
        {sheet && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            sheet.status === "reviewed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : sheet.status === "submitted"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-card/80 dark:text-zinc-400"
          }`}>
            {sheet.status === "reviewed" ? "評価完了" : sheet.status === "submitted" ? "提出済み" : "下書き"}
          </span>
        )}
      </div>

      {/* 評価基準 */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-card">
        <p className="mb-2 text-xs font-semibold">評価基準</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {SCORE_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-center gap-2 text-xs">
              <span className={`flex h-6 w-8 shrink-0 items-center justify-center rounded font-bold ${
                o.value > 0
                  ? "bg-accent/10 text-accent"
                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              }`}>
                {o.label}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">{o.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* リアルタイム合計・倍率（上部サマリー） */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">自己評価</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">
            {total}
            <span className="text-sm font-normal text-zinc-400"> / {maxScore}</span>
          </p>
          <p className={`text-sm font-bold tabular-nums ${
            multiplier > 1.0 ? "text-emerald-600 dark:text-emerald-400"
            : multiplier < 1.0 ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"
          }`}>
            ×{multiplier.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">上長評価</p>
          {managerTotal != null ? (
            <>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">
                {managerTotal}
                <span className="text-sm font-normal text-zinc-400"> / {maxScore}</span>
              </p>
              <p className={`text-sm font-bold tabular-nums ${
                managerMultiplier! > 1.0 ? "text-emerald-600 dark:text-emerald-400"
                : managerMultiplier! < 1.0 ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"
              }`}>
                ×{managerMultiplier!.toFixed(1)}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-300 dark:text-zinc-600">未評価</p>
          )}
        </div>
      </div>

      {/* カテゴリごとの評価セクション */}
      {categories.map((cat) => (
        <section key={cat.name} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 bg-accent/5 px-4 py-2.5 dark:border-zinc-800 dark:bg-accent/10">
            <h2 className="text-sm font-bold text-accent">【{cat.name}】</h2>
          </div>

          {/* 2列ヘッダー */}
          <div className="hidden border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 dark:border-zinc-800 dark:bg-card sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4">
            <span className="text-[10px] font-medium text-zinc-400">評価項目</span>
            <span className="w-[176px] text-center text-[10px] font-medium text-zinc-400">自己評価</span>
            <span className="w-[44px] text-center text-[10px] font-medium text-zinc-400">上長</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {cat.indices.map((idx) => {
              const ci = items[idx];
              const mEntry = sheet?.manager_check?.find((c) => c.item === ci.item);
              return (
                <div key={idx} className="px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
                  {/* 項目テキスト */}
                  <p className="mb-2 text-sm leading-relaxed sm:mb-0">
                    <span className="mr-1 inline-block min-w-[1.25rem] text-xs tabular-nums text-zinc-400">{idx + 1}.</span>
                    {ci.item}
                  </p>

                  {/* 自己評価ボタン */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-400 sm:hidden">自己</span>
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
                                ? "bg-accent text-white shadow-sm"
                                : "bg-red-500 text-white shadow-sm"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-card/80 dark:text-zinc-400 dark:hover:bg-zinc-700"
                          } disabled:cursor-default`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 上長評価 */}
                  <div className="mt-2 flex items-center gap-2 sm:mt-0">
                    <span className="text-[10px] font-medium text-zinc-400 sm:hidden">上長</span>
                    {mEntry ? (
                      <span className={`flex h-8 w-10 items-center justify-center rounded-lg text-xs font-bold ${
                        mEntry.score > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {mEntry.score > 0 ? "+" : ""}{mEntry.score}
                      </span>
                    ) : (
                      <span className="flex h-8 w-10 items-center justify-center rounded-lg bg-zinc-50 text-xs text-zinc-300 dark:bg-card dark:text-zinc-600">
                        —
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* 倍率スコア表 + 提出 */}
      <section className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5 dark:border-accent/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500">自己評価 合計</p>
            <p className="text-3xl font-bold tabular-nums">
              {total}
              <span className="text-base font-normal text-zinc-500"> / {maxScore}</span>
            </p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${
              multiplier > 1.0 ? "text-emerald-600 dark:text-emerald-400"
              : multiplier < 1.0 ? "text-red-600 dark:text-red-400" : ""
            }`}>
              倍率 ×{multiplier.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">上長評価 合計</p>
            {managerTotal != null ? (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {managerTotal}
                  <span className="text-base font-normal text-zinc-500"> / {maxScore}</span>
                </p>
                <p className={`mt-1 text-lg font-bold tabular-nums ${
                  managerMultiplier! > 1.0 ? "text-emerald-600 dark:text-emerald-400"
                  : managerMultiplier! < 1.0 ? "text-red-600 dark:text-red-400" : ""
                }`}>
                  倍率 ×{managerMultiplier!.toFixed(1)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">未評価</p>
            )}
          </div>
        </div>

        {/* 倍率スコア表 */}
        <div className="mt-4 rounded-lg border border-zinc-200/50 bg-white/60 p-3 dark:border-zinc-700/50 dark:bg-card">
          <p className="mb-1.5 text-[10px] font-semibold text-zinc-500">倍率スコア表（{items.length}項目・最大{maxScore}点）</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {multiplierTable.map((r, i) => (
              <span key={i} className={`text-xs tabular-nums ${
                multiplier === r.multiplier ? "font-bold text-accent" : "text-zinc-500"
              }`}>
                {r.range} → ×{r.multiplier.toFixed(1)}
              </span>
            ))}
          </div>
        </div>

        {/* 提出ボタン */}
        {!isSubmitted && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={submitCheck}
              disabled={saving || !allAnswered}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "提出中..." : !allAnswered ? "全項目を入力してください" : "提出する"}
            </button>
          </div>
        )}
      </section>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </>
  );
}
