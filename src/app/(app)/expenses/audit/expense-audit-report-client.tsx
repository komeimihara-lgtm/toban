"use client";

import { useMemo, useState } from "react";

type BatchPayload = {
  year: number;
  month: number;
  expense_count: number;
  month_total_jpy: number;
  transport_total_jpy: number;
  prev_month_transport_jpy: number;
  suggested_savings_jpy: number;
  lodging_vs_recommended?: {
    recommended_range_per_night: string;
    cap_per_night_jpy: number;
    lodging_expense_count: number;
    total_lodging_jpy: number;
    total_excess_over_recommended_jpy: number;
    items: {
      id: string;
      submitter_name: string | null;
      paid_date: string;
      category: string;
      amount_jpy: number;
      estimated_nights: number;
      per_night_jpy: number;
      excess_over_recommended_jpy: number;
    }[];
  };
  annual_savings_projection_jpy?: number;
  category_savings_jpy?: Record<string, number>;
  reduction_proposals_top5?: {
    id: string;
    amount: number;
    category: string;
    submitter_name: string | null;
    paid_date: string;
    heuristic_saving: number;
  }[];
  sales_efficiency?: {
    team_avg_cost_per_deal_jpy: number;
    prev_month_team_avg_cost_per_deal_jpy: number;
    ranking: {
      rank: number;
      submitter_id: string;
      full_name: string;
      transport_jpy: number;
      lodging_jpy: number;
      estimated_deals: number;
      cost_per_deal_jpy: number;
    }[];
    consolidation_suggestions: {
      submitter_name: string | null;
      area_hint: string;
      trip_count: number;
      total_jpy: number;
      suggested_saving_jpy: number;
      note: string;
    }[];
    online_shift_estimate_jpy: number;
    monthly_trend?: {
      year: number;
      month: number;
      team_avg_cost_per_deal_jpy: number;
      company_transport_jpy: number;
      lodging_per_deal_jpy: number;
    }[];
  };
  department_stats: {
    department_id: string | null;
    department_name: string;
    total: number;
    count: number;
    transport_total: number;
  }[];
  reduction_candidates: {
    id: string;
    amount: number;
    category: string;
    submitter_name: string | null;
    paid_date: string;
    heuristic_saving: number;
  }[];
  low_audit_scores: {
    id: string;
    amount: number;
    category: string;
    submitter_name: string | null;
    audit_score: number | null;
    paid_date: string;
  }[];
  approver_notes: string;
  report_md: string;
  error?: string;
};

export function ExpenseAuditReportClient({
  defaultYear,
  defaultMonth,
}: {
  defaultYear: number;
  defaultMonth: number;
}) {
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<BatchPayload | null>(null);

  const maxBar = useMemo(() => {
    if (!data?.department_stats.length) return 1;
    return Math.max(...data.department_stats.map((d) => d.total), 1);
  }, [data]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/audit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const j = (await res.json()) as BatchPayload & { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "読み込みに失敗しました");
        setData(null);
        return;
      }
      setData(j);
    } catch {
      setErr("通信エラー");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function shareReport() {
    if (!data) return;
    const text = [
      `# 経費審査レポート ${data.year}年${data.month}月`,
      "",
      data.approver_notes,
      "",
      data.report_md,
      "",
      `月間合計: ¥${data.month_total_jpy.toLocaleString("ja-JP")}`,
      `削減試算（参考・月次）: ¥${data.suggested_savings_jpy.toLocaleString("ja-JP")}`,
      `年間試算（このペース改善時）: ¥${(data.annual_savings_projection_jpy ?? 0).toLocaleString("ja-JP")}`,
      ...(data.lodging_vs_recommended
        ? [
            "",
            `【宿泊費】推奨レンジ ${data.lodging_vs_recommended.recommended_range_per_night}（超過試算基準 ¥${data.lodging_vs_recommended.cap_per_night_jpy.toLocaleString("ja-JP")}/泊）`,
            `宿泊申請: ${data.lodging_vs_recommended.lodging_expense_count} 件 / 計 ¥${data.lodging_vs_recommended.total_lodging_jpy.toLocaleString("ja-JP")}`,
            `推奨上限を超える額の合計（試算）: ¥${data.lodging_vs_recommended.total_excess_over_recommended_jpy.toLocaleString("ja-JP")}`,
          ]
        : []),
    ].join("\n");
    void navigator.clipboard.writeText(text).then(() => {
      alert("レポート本文をクリップボードにコピーしました。メールやドキュメントに貼り付けて共有できます。");
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            月次経費審査レポート
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            AI が承認者向けサマリーと削減の着眼点を生成します（数値は paid_date
            基準）。
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-500">
            年
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="ml-1 w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <label className="text-xs text-zinc-500">
            月
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="ml-1 w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "生成中…" : "レポート生成"}
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </p>
      )}

      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card">
              <p className="text-xs font-medium text-zinc-500">申請件数</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.expense_count}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card">
              <p className="text-xs font-medium text-zinc-500">月間合計</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                ¥{data.month_total_jpy.toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card">
              <p className="text-xs font-medium text-zinc-500">
                削減候補（試算・税抜は加味しません）
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                ¥{data.suggested_savings_jpy.toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card sm:col-span-3">
              <p className="text-xs font-medium text-zinc-500">
                年間試算（同ペースで改善した場合の参考値）
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                約 ¥
                {(data.annual_savings_projection_jpy ?? 0).toLocaleString("ja-JP")}
                <span className="text-sm font-normal text-zinc-500"> / 年</span>
              </p>
            </div>
          </section>

          {data.lodging_vs_recommended &&
          data.lodging_vs_recommended.lodging_expense_count > 0 ? (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
              <h2 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                宿泊費（会社推奨レンジとの比較）
              </h2>
              <p className="mt-1 text-xs text-indigo-900/85 dark:text-indigo-200/90">
                推奨: {data.lodging_vs_recommended.recommended_range_per_night}
                。超過試算は1泊あたり¥
                {data.lodging_vs_recommended.cap_per_night_jpy.toLocaleString("ja-JP")}
                を上限として、申請金額との差分を合算しています（泊数は用途欄の記載がなければ金額から推定）。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 dark:border-indigo-900/40 dark:bg-card/50">
                  <p className="text-xs text-zinc-500">宿泊件数</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {data.lodging_vs_recommended.lodging_expense_count}
                  </p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 dark:border-indigo-900/40 dark:bg-card/50">
                  <p className="text-xs text-zinc-500">宿泊費合計</p>
                  <p className="text-lg font-semibold tabular-nums">
                    ¥
                    {data.lodging_vs_recommended.total_lodging_jpy.toLocaleString("ja-JP")}
                  </p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 dark:border-indigo-900/40 dark:bg-card/50">
                  <p className="text-xs text-zinc-500">推奨上限超過分（試算）</p>
                  <p className="text-lg font-semibold text-amber-800 tabular-nums dark:text-amber-300">
                    ¥
                    {data.lodging_vs_recommended.total_excess_over_recommended_jpy.toLocaleString(
                      "ja-JP",
                    )}
                  </p>
                </div>
              </div>
              <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
                {data.lodging_vs_recommended.items.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-indigo-100 px-3 py-2 dark:border-indigo-900/50"
                  >
                    <span>
                      <span className="font-medium">{row.category}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {row.submitter_name ?? "—"} · {row.paid_date} · 推定{" "}
                        {row.estimated_nights}泊（1泊¥
                        {row.per_night_jpy.toLocaleString("ja-JP")}）
                      </span>
                    </span>
                    <span className="tabular-nums text-xs">
                      支払 ¥{row.amount_jpy.toLocaleString("ja-JP")}
                      {row.excess_over_recommended_jpy > 0 ? (
                        <span className="ml-2 text-amber-800 dark:text-amber-300">
                          超過 ¥{row.excess_over_recommended_jpy.toLocaleString("ja-JP")}
                        </span>
                      ) : (
                        <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                          推奨内
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.sales_efficiency?.ranking?.length ? (
            <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-900 dark:bg-teal-950/25">
              <h2 className="text-sm font-semibold text-teal-950 dark:text-teal-100">
                営業効率（商談1件あたりの移動コスト・低いほど効率良）
              </h2>
              <p className="mt-1 text-xs text-teal-900/80 dark:text-teal-200/90">
                チーム平均（交通費÷推定商談件数）: 今月 ¥
                {data.sales_efficiency.team_avg_cost_per_deal_jpy.toLocaleString("ja-JP")}
                {" · "}
                前月 ¥
                {data.sales_efficiency.prev_month_team_avg_cost_per_deal_jpy.toLocaleString(
                  "ja-JP",
                )}
              </p>
              <p className="mt-2 text-xs text-teal-900/80 dark:text-teal-200/90">
                オンライン商談への置き換え試算（参考）: 約 ¥
                {data.sales_efficiency.online_shift_estimate_jpy.toLocaleString("ja-JP")}
              </p>
              <ul className="mt-4 divide-y divide-teal-100 dark:divide-teal-900">
                {data.sales_efficiency.ranking.slice(0, 12).map((r) => (
                  <li
                    key={r.submitter_id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      <span className="inline-block w-7 tabular-nums text-zinc-500">
                        {r.rank}
                      </span>
                      {r.full_name}
                      <span className="ml-2 text-xs text-zinc-500">
                        推定{r.estimated_deals}件 · 交通 ¥
                        {r.transport_jpy.toLocaleString("ja-JP")} · 宿泊 ¥
                        {r.lodging_jpy.toLocaleString("ja-JP")}
                      </span>
                    </span>
                    <span className="tabular-nums font-medium text-teal-900 dark:text-teal-100">
                      ¥{r.cost_per_deal_jpy.toLocaleString("ja-JP")} / 件
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.sales_efficiency?.monthly_trend && data.sales_efficiency.monthly_trend.length > 0 ? (
            <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-5 dark:border-cyan-900 dark:bg-cyan-950/25">
              <h2 className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
                月別トレンド（チーム平均・1件あたり移動コスト / 全社交通費）
              </h2>
              <p className="mt-1 text-xs text-cyan-900/85 dark:text-cyan-200/90">
                直近6ヶ月＋当月。青系バー: チーム平均の商談1件あたり交通費。グレー: 全社交通費合計（最大比）。
              </p>
              <div className="mt-4 space-y-4">
                {(() => {
                  const trend = data.sales_efficiency!.monthly_trend!;
                  const maxT = Math.max(...trend.map((t) => t.team_avg_cost_per_deal_jpy), 1);
                  const maxTr = Math.max(...trend.map((t) => t.company_transport_jpy), 1);
                  return trend.map((t) => (
                    <div key={`${t.year}-${t.month}`}>
                      <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {t.year}年{t.month}月
                        </span>
                        <span className="tabular-nums">
                          平均 ¥{t.team_avg_cost_per_deal_jpy.toLocaleString("ja-JP")}/件 · 交通計 ¥
                          {t.company_transport_jpy.toLocaleString("ja-JP")}
                          {t.lodging_per_deal_jpy > 0
                            ? ` · 宿泊/件 約¥${t.lodging_per_deal_jpy.toLocaleString("ja-JP")}`
                            : ""}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-card/80">
                        <div
                          className="h-full rounded-full bg-cyan-500"
                          style={{
                            width: `${Math.min(100, (t.team_avg_cost_per_deal_jpy / maxT) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-card">
                        <div
                          className="h-full rounded-full bg-zinc-400/90 dark:bg-zinc-600"
                          style={{
                            width: `${Math.min(100, (t.company_transport_jpy / maxTr) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          ) : null}

          {data.sales_efficiency?.consolidation_suggestions?.length ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                出張の集約提案
              </h2>
              <ul className="mt-3 space-y-3 text-sm">
                {data.sales_efficiency.consolidation_suggestions.map((c, i) => (
                  <li
                    key={`${c.submitter_name}-${c.area_hint}-${i}`}
                    className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2 dark:border-amber-900/50 dark:bg-card/50"
                  >
                    <p className="font-medium text-amber-950 dark:text-amber-100">
                      {c.submitter_name ?? "—"} · {c.area_hint}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {c.trip_count} 件 / 計 ¥{c.total_jpy.toLocaleString("ja-JP")}{" "}
                      · まとめ候補の削減目安 ¥
                      {c.suggested_saving_jpy.toLocaleString("ja-JP")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{c.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              カテゴリ別・削減試算の内訳
            </h2>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
              {Object.keys(data.category_savings_jpy ?? {}).length === 0 ? (
                <li className="text-zinc-500">該当なし</li>
              ) : (
                Object.entries(data.category_savings_jpy ?? {}).map(([cat, jpy]) => (
                  <li key={cat} className="flex justify-between gap-2 tabular-nums">
                    <span className="text-zinc-700 dark:text-zinc-300">{cat}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      ¥{jpy.toLocaleString("ja-JP")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              削減提案 TOP5
            </h2>
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {(data.reduction_proposals_top5 ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.category}</span>
                    <span className="ml-2 text-zinc-500">
                      {r.submitter_name ?? r.id.slice(0, 8)} · {r.paid_date}
                    </span>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div>¥{Number(r.amount).toLocaleString("ja-JP")}</div>
                    <div className="text-emerald-700 dark:text-emerald-400">
                      試算 ¥{r.heuristic_saving.toLocaleString("ja-JP")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              部門別コスト傾向
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              棒グラフ: 部門別支払合計（幅は最大比）
            </p>
            <ul className="mt-4 space-y-3">
              {data.department_stats.map((d) => (
                <li key={String(d.department_id) + d.department_name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{d.department_name}</span>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                      ¥{Math.round(d.total).toLocaleString("ja-JP")}（{d.count} 件）
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-card/80">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{
                        width: `${Math.min(100, (d.total / maxBar) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    交通系: ¥{Math.round(d.transport_total).toLocaleString("ja-JP")}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              削減提案リスト（金額・試算の大きい順）
            </h2>
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.reduction_candidates.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.category}</span>
                    <span className="ml-2 text-zinc-500">
                      {r.submitter_name ?? r.id.slice(0, 8)} · {r.paid_date}
                    </span>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div>¥{Number(r.amount).toLocaleString("ja-JP")}</div>
                    <div className="text-emerald-700 dark:text-emerald-400">
                      試算削減 ¥{r.heuristic_saving.toLocaleString("ja-JP")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              スコアが低い申請（審査済みのみ）
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.low_audit_scores.length === 0 && (
                <li className="text-zinc-500">該当なし</li>
              )}
              {data.low_audit_scores.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <span>
                    {r.category} — {r.submitter_name ?? "—"}
                  </span>
                  <span className="tabular-nums">
                    ¥{Number(r.amount).toLocaleString("ja-JP")} · スコア{" "}
                    {r.audit_score ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900 dark:bg-violet-950/30">
            <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
              承認者向け・AIサマリー
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-violet-900 dark:text-violet-200">
              {data.approver_notes}
            </p>
            {data.report_md ? (
              <div className="mt-4 rounded-lg border border-violet-200 bg-white/80 p-4 text-sm dark:border-violet-900 dark:bg-card">
                <p className="mb-2 text-xs font-medium text-zinc-500">詳細（Markdown）</p>
                <pre className="whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200">
                  {data.report_md}
                </pre>
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => shareReport()}
              className="rounded-lg border border-zinc-400 px-4 py-2 text-sm font-medium dark:border-zinc-500"
            >
              税理士・社労士に共有（コピー）
            </button>
            <p className="self-center text-xs text-zinc-500">
              クリップボードにレポート本文をコピーします。メール等へ貼り付けてください。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
