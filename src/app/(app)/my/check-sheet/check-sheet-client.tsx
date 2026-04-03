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

type CheckEntry = { item: string; score: number };

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
}: {
  currentSheet: Sheet | null;
  year: number;
  month: number;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(currentSheet);
  const [selfScores, setSelfScores] = useState<number[]>(
    sheet?.self_check?.length
      ? CHECK_ITEMS.map((item) => {
          const found = sheet!.self_check.find((c) => c.item === item);
          return found?.score ?? 3;
        })
      : CHECK_ITEMS.map(() => 3)
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function submitCheck() {
    setSaving(true);
    try {
      const self_check = CHECK_ITEMS.map((item, i) => ({
        item,
        score: selfScores[i],
      }));
      const res = await fetch("/api/check-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, self_check }),
      });
      if (!res.ok) {
        showToast("提出に失敗しました");
        return;
      }
      const { sheet: saved } = await res.json();
      setSheet(saved);
      showToast("提出しました");
    } catch {
      showToast("提出に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const isSubmitted = sheet?.status === "submitted" || sheet?.status === "reviewed";

  const selfAvg = selfScores.reduce((a, b) => a + b, 0) / selfScores.length;
  const managerScores = sheet?.manager_check?.length
    ? sheet.manager_check.map((c) => c.score)
    : null;
  const managerAvg = managerScores
    ? managerScores.reduce((a, b) => a + b, 0) / managerScores.length
    : null;

  return (
    <>
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">{year}年{month}月 自己評価</h2>
          {sheet && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              sheet.status === "reviewed"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {sheet.status === "reviewed" ? "評価完了" : sheet.status === "submitted" ? "提出済み" : "下書き"}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {CHECK_ITEMS.map((item, i) => (
            <div key={item} className="flex items-center justify-between gap-4">
              <span className="flex-1 text-sm">{item}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    onClick={() => {
                      if (isSubmitted) return;
                      const next = [...selfScores];
                      next[i] = score;
                      setSelfScores(next);
                    }}
                    disabled={isSubmitted}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      selfScores[i] === score
                        ? "bg-accent text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    } disabled:cursor-default`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <span className="text-sm font-medium">自己評価平均: {selfAvg.toFixed(1)} / 5.0</span>
          {!isSubmitted && (
            <button
              onClick={submitCheck}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "提出中..." : "提出する"}
            </button>
          )}
        </div>
      </section>

      {/* 上司評価（提出後に表示） */}
      {sheet?.manager_check && sheet.manager_check.length > 0 && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">上司評価</h2>
          <div className="mt-4 space-y-3">
            {CHECK_ITEMS.map((item, i) => {
              const mEntry = sheet!.manager_check.find((c) => c.item === item);
              return (
                <div key={item} className="flex items-center justify-between gap-4">
                  <span className="flex-1 text-sm">{item}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">自己: {selfScores[i]}</span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      mEntry && mEntry.score >= 4 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : mEntry && mEntry.score <= 2 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800"
                    }`}>
                      上司: {mEntry?.score ?? "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {managerAvg != null && (
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <span className="text-sm font-medium">上司評価平均: {managerAvg.toFixed(1)} / 5.0</span>
            </div>
          )}
        </section>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </>
  );
}
