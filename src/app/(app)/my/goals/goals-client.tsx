"use client";

import { useState } from "react";

type Kpi = { name: string; target: string; unit: string; actual?: string };
type GoalRow = {
  id: string; year: number; month: number; theme: string;
  goals: string[]; kpis: Kpi[]; status: string;
  result_input: { kpi_results?: { actual: string; comment: string }[]; comment?: string } | null;
  approved_by: string | null; ai_evaluation: string | null; ai_score: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き", submitted: "提出済み", approved: "承認済み",
  rejected: "差戻し", result_submitted: "結果提出済み",
};

export function GoalsClient({
  currentGoal,
  history,
  year,
  month,
}: {
  currentGoal: GoalRow | null;
  history: unknown[];
  year: number;
  month: number;
  employeeName: string;
}) {
  const [goal, setGoal] = useState<GoalRow | null>(currentGoal);
  const [theme, setTheme] = useState(goal?.theme ?? "");
  const [goals, setGoals] = useState<string[]>(goal?.goals ?? [""]);
  const [kpis, setKpis] = useState<Kpi[]>(
    goal?.kpis?.length ? goal.kpis : [{ name: "", target: "", unit: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [resultComment, setResultComment] = useState(goal?.result_input?.comment ?? "");
  const [kpiResults, setKpiResults] = useState<{ actual: string; comment: string }[]>(
    goal?.result_input?.kpi_results ?? goal?.kpis?.map(() => ({ actual: "", comment: "" })) ?? []
  );
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score?: number; evaluation?: string;
    strengths?: string[]; improvements?: string[];
    next_month_advice?: string;
  } | null>(goal?.ai_evaluation ? (() => { try { return JSON.parse(goal.ai_evaluation!); } catch { return null; } })() : null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function saveGoal() {
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, theme, goals: goals.filter(Boolean), kpis }),
      });
      if (!res.ok) { showToast("保存に失敗しました"); return; }
      const { goal: saved } = await res.json();
      setGoal(saved);
      showToast("保存しました");
    } catch { showToast("保存に失敗しました"); }
    finally { setSaving(false); }
  }

  async function submitGoal() {
    if (!goal) return;
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, action: "submit" }),
      });
      if (!res.ok) { showToast("提出に失敗しました"); return; }
      setGoal({ ...goal, status: "submitted" });
      showToast("提出しました");
    } catch { showToast("提出に失敗しました"); }
    finally { setSaving(false); }
  }

  async function submitResult() {
    if (!goal) return;
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: goal.id, action: "submit_result",
          result_input: { kpi_results: kpiResults, comment: resultComment },
        }),
      });
      if (!res.ok) { showToast("結果提出に失敗しました"); return; }
      setGoal({ ...goal, status: "result_submitted", result_input: { kpi_results: kpiResults, comment: resultComment } });
      showToast("結果を提出しました");
    } catch { showToast("結果提出に失敗しました"); }
    finally { setSaving(false); }
  }

  async function requestEvaluation() {
    if (!goal) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/goals/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goal.id }),
      });
      if (!res.ok) { showToast("AI評価に失敗しました"); return; }
      const { evaluation: ev } = await res.json();
      setEvaluation(ev);
      setGoal({ ...goal, ai_score: ev.score, ai_evaluation: JSON.stringify(ev) });
      showToast("AI評価が完了しました");
    } catch { showToast("AI評価に失敗しました"); }
    finally { setEvaluating(false); }
  }

  const isEditable = !goal || goal.status === "draft" || goal.status === "rejected";
  const canSubmit = goal && goal.status === "draft" && theme.trim();
  const canSubmitResult = goal && goal.status === "approved";

  return (
    <>
      {/* 今月の目標設定 */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">{year}年{month}月の目標</h2>
          {goal && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              goal.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : goal.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {STATUS_LABEL[goal.status] ?? goal.status}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500">どんな1ヶ月にするか（テーマ）</label>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={!isEditable}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="例: 新規顧客3件獲得と既存顧客のフォロー強化"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500">目標（複数可）</label>
            {goals.map((g, i) => (
              <div key={i} className="mt-1 flex gap-2">
                <input
                  value={g}
                  onChange={(e) => {
                    const next = [...goals];
                    next[i] = e.target.value;
                    setGoals(next);
                  }}
                  disabled={!isEditable}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder={`目標 ${i + 1}`}
                />
                {isEditable && goals.length > 1 && (
                  <button onClick={() => setGoals(goals.filter((_, j) => j !== i))} className="text-xs text-red-500">削除</button>
                )}
              </div>
            ))}
            {isEditable && (
              <button onClick={() => setGoals([...goals, ""])} className="mt-1 text-xs text-accent">+ 追加</button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500">KPI（数値目標）</label>
            {kpis.map((kpi, i) => (
              <div key={i} className="mt-1 flex gap-2">
                <input
                  value={kpi.name}
                  onChange={(e) => { const next = [...kpis]; next[i] = { ...kpi, name: e.target.value }; setKpis(next); }}
                  disabled={!isEditable}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="項目名"
                />
                <input
                  value={kpi.target}
                  onChange={(e) => { const next = [...kpis]; next[i] = { ...kpi, target: e.target.value }; setKpis(next); }}
                  disabled={!isEditable}
                  className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="目標値"
                />
                <input
                  value={kpi.unit}
                  onChange={(e) => { const next = [...kpis]; next[i] = { ...kpi, unit: e.target.value }; setKpis(next); }}
                  disabled={!isEditable}
                  className="w-16 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="単位"
                />
                {isEditable && kpis.length > 1 && (
                  <button onClick={() => setKpis(kpis.filter((_, j) => j !== i))} className="text-xs text-red-500">削除</button>
                )}
              </div>
            ))}
            {isEditable && (
              <button onClick={() => setKpis([...kpis, { name: "", target: "", unit: "" }])} className="mt-1 text-xs text-accent">+ KPI追加</button>
            )}
          </div>

          {isEditable && (
            <div className="flex gap-2">
              <button onClick={saveGoal} disabled={saving} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900">
                {saving ? "保存中..." : "下書き保存"}
              </button>
              {canSubmit && (
                <button onClick={submitGoal} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50">
                  提出する
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 結果入力（承認済みの場合） */}
      {canSubmitResult && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">月末結果入力</h2>
          <div className="mt-4 space-y-3">
            {kpis.map((kpi, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 text-sm">{kpi.name}</span>
                <span className="text-xs text-zinc-500">目標: {kpi.target}{kpi.unit}</span>
                <input
                  value={kpiResults[i]?.actual ?? ""}
                  onChange={(e) => {
                    const next = [...kpiResults];
                    next[i] = { ...next[i], actual: e.target.value };
                    setKpiResults(next);
                  }}
                  className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="実績値"
                />
                <input
                  value={kpiResults[i]?.comment ?? ""}
                  onChange={(e) => {
                    const next = [...kpiResults];
                    next[i] = { ...next[i], comment: e.target.value };
                    setKpiResults(next);
                  }}
                  className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="コメント"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-zinc-500">振り返りコメント</label>
              <textarea
                value={resultComment}
                onChange={(e) => setResultComment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="今月の振り返り..."
              />
            </div>
            <button onClick={submitResult} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50">
              {saving ? "提出中..." : "結果を提出"}
            </button>
          </div>
        </section>
      )}

      {/* AI評価 */}
      {goal && (goal.status === "result_submitted" || goal.ai_evaluation) && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">AI評価</h2>
          {!evaluation && (
            <button onClick={requestEvaluation} disabled={evaluating} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-50">
              {evaluating ? "評価中..." : "AI評価を実行"}
            </button>
          )}
          {evaluation && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{evaluation.score}</span>
                <span className="text-sm text-zinc-500">/ 100点</span>
              </div>
              <p className="text-sm leading-relaxed">{evaluation.evaluation}</p>
              {evaluation.strengths && evaluation.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600">強み</p>
                  <ul className="ml-4 list-disc text-sm">{evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {evaluation.improvements && evaluation.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600">改善点</p>
                  <ul className="ml-4 list-disc text-sm">{evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {evaluation.next_month_advice && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">来月へのアドバイス</p>
                  <p className="mt-1">{evaluation.next_month_advice}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 過去の目標履歴 */}
      {(history as GoalRow[]).length > 0 && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">過去の目標</h2>
          <div className="mt-3 space-y-2">
            {(history as GoalRow[]).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium">{h.year}年{h.month}月</p>
                  <p className="text-xs text-zinc-500">{h.theme}</p>
                </div>
                <div className="flex items-center gap-3">
                  {h.ai_score != null && (
                    <span className="text-sm font-bold">{h.ai_score}点</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    h.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800"
                  }`}>
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
