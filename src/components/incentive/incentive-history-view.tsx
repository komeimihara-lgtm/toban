"use client";

export type MonthlyAgg = {
  ym: string;
  year: number;
  month: number;
  total: number;
  statusLabel: string;
};

export function IncentiveHistoryView({
  monthly,
  detailRows,
}: {
  monthly: MonthlyAgg[];
  detailRows: {
    id: string;
    year: number;
    month: number;
    employee_name: string | null;
    incentive_amount: number;
    status: string;
  }[];
}) {
  const max = Math.max(1, ...monthly.map((m) => m.total));

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">月別推移（棒グラフ）</h2>
        <div className="mt-4 space-y-2">
          {monthly.length === 0 ? (
            <p className="text-sm text-zinc-500">データがありません</p>
          ) : (
            [...monthly]
              .sort((a, b) =>
                a.year !== b.year ? b.year - a.year : b.month - a.month,
              )
              .map((m) => (
                <div key={m.ym} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {m.ym}
                  </span>
                  <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-amber-500/90 dark:bg-amber-600/90"
                      style={{ width: `${(m.total / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right tabular-nums font-medium">
                    {new Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "JPY",
                      maximumFractionDigits: 0,
                    }).format(m.total)}
                  </span>
                </div>
              ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          月別サマリ（合計・ステータス）
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2">月</th>
                <th className="px-3 py-2">合計</th>
                <th className="px-3 py-2">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly]
                .sort((a, b) =>
                  a.year !== b.year ? b.year - a.year : b.month - a.month,
                )
                .map((m) => (
                  <tr
                    key={m.ym}
                    className="border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2 tabular-nums">{m.ym}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {new Intl.NumberFormat("ja-JP", {
                        style: "currency",
                        currency: "JPY",
                        maximumFractionDigits: 0,
                      }).format(m.total)}
                    </td>
                    <td className="px-3 py-2">{m.statusLabel}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          支給履歴（明細）
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2">年月</th>
                <th className="px-3 py-2">氏名</th>
                <th className="px-3 py-2">金額</th>
                <th className="px-3 py-2">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="px-3 py-2 tabular-nums">
                    {row.year}-{String(row.month).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2">{row.employee_name ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {new Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "JPY",
                    }).format(Number(row.incentive_amount))}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
