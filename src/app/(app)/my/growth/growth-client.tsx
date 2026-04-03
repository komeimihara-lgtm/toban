"use client";

import { useState } from "react";

type GoalRow = {
  id: string; year: number; month: number; theme: string;
  status: string; ai_score: number | null; ai_evaluation: string | null;
  kpis: { name: string; target: string; unit: string }[];
  result_input: { kpi_results?: { actual: string; comment: string }[] } | null;
};
type SheetRow = {
  year: number; month: number;
  self_check: { item: string; score: number }[];
  manager_check: { item: string; score: number }[];
  status: string;
};

export function GrowthClient({
  goals,
  sheets,
  employeeName,
}: {
  goals: GoalRow[];
  sheets: SheetRow[];
  employeeName: string;
}) {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function generateSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/goals/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_id: goals[goals.length - 1]?.id,
        }),
      });
      if (!res.ok) { showToast("サマリー生成に失敗しました"); return; }
      const { evaluation } = await res.json();
      setSummary(evaluation.evaluation ?? "評価を生成できませんでした。");
    } catch { showToast("サマリー生成に失敗しました"); }
    finally { setSummaryLoading(false); }
  }

  // チェックシートスコア計算
  function sheetAvg(items: { score: number }[]): number {
    if (!items?.length) return 0;
    return items.reduce((a, b) => a + b.score, 0) / items.length;
  }

  const maxScore = 100;

  return (
    <>
      {/* AI スコア推移 */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">月間目標スコア推移</h2>
        {goals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">まだ目標の記録がありません。</p>
        ) : (
          <div className="mt-4 flex items-end gap-2">
            {goals.map((g) => {
              const score = g.ai_score ?? 0;
              const h = Math.max((score / maxScore) * 120, 4);
              return (
                <div key={g.id} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium">{score || "—"}</span>
                  <div
                    className={`w-10 rounded-t-md ${score > 0 ? "bg-accent" : "bg-zinc-200 dark:bg-zinc-700"}`}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[10px] text-zinc-500">{g.month}月</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* チェックシートスコア推移 */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">チェックシートスコア推移</h2>
        {sheets.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">まだチェックシートの記録がありません。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-2 pr-3">月</th>
                  <th className="py-2 pr-3">自己評価</th>
                  <th className="py-2 pr-3">上司評価</th>
                  <th className="py-2">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="py-2 pr-3">{s.year}/{s.month}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{sheetAvg(s.self_check).toFixed(1)}</span>
                      <span className="text-zinc-500"> / 5.0</span>
                    </td>
                    <td className="py-2 pr-3">
                      {s.manager_check?.length ? (
                        <>
                          <span className="font-medium">{sheetAvg(s.manager_check).toFixed(1)}</span>
                          <span className="text-zinc-500"> / 5.0</span>
                        </>
                      ) : "未評価"}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        s.status === "reviewed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-card/80"
                      }`}>{s.status === "reviewed" ? "完了" : s.status === "submitted" ? "提出済み" : "下書き"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI評価コメント履歴 */}
      {goals.some((g) => g.ai_evaluation) && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">AI評価コメント履歴</h2>
          <div className="mt-3 space-y-3">
            {goals.filter((g) => g.ai_evaluation).map((g) => {
              let ev: { evaluation?: string; strengths?: string[]; next_month_advice?: string } = {};
              try { ev = JSON.parse(g.ai_evaluation!); } catch { /* skip */ }
              return (
                <div key={g.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500">{g.year}年{g.month}月 — {g.ai_score}点</p>
                  <p className="mt-1 text-sm leading-relaxed">{ev.evaluation}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 成長サマリー */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">成長サマリー</h2>
        {summary ? (
          <p className="mt-3 text-sm leading-relaxed">{summary}</p>
        ) : (
          <button
            onClick={generateSummary}
            disabled={summaryLoading || goals.length === 0}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {summaryLoading ? "生成中..." : `${employeeName}の成長サマリーを生成`}
          </button>
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
