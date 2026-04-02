"use client";

import { useMemo, useState } from "react";

export type MyDealRow = {
  id: string;
  year: number;
  month: number;
  salon_name: string;
  machine_type: string;
  role: "appo" | "closer" | "hito";
  role_label: string;
  amount: number;
  payment_status: string;
  payment_date: string | null;
};

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function ymLabel(y: number, m: number) {
  return `${y}年${String(m).padStart(2, "0")}月`;
}

export function MyIncentiveDealsClient(props: {
  initialDeals: MyDealRow[];
  months: { year: number; month: number }[];
}) {
  const [selectedYm, setSelectedYm] = useState(() => {
    const m = props.months[0];
    return m ? `${m.year}-${m.month}` : "";
  });

  const byMonth = useMemo(() => {
    const map = new Map<string, MyDealRow[]>();
    for (const d of props.initialDeals) {
      const k = `${d.year}-${d.month}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return map;
  }, [props.initialDeals]);

  const currentRows = selectedYm ? byMonth.get(selectedYm) ?? [] : [];

  const monthTotal = useMemo(
    () => currentRows.reduce((a, r) => a + r.amount, 0),
    [currentRows],
  );

  const monthKey = (y: number, m: number) => `${y}-${m}`;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">表示月</label>
        <select
          className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          value={selectedYm}
          onChange={(e) => setSelectedYm(e.target.value)}
        >
          {props.months.map((m) => {
            const k = monthKey(m.year, m.month);
            return (
              <option key={k} value={k}>
                {ymLabel(m.year, m.month)}
              </option>
            );
          })}
        </select>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">担当案件（プレビュー）</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          アポ・クローザー・ヒト幹として割り当てられた案件のみ表示します。全額入金後（進捗「全額入金」）で支給確定となります。
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50">
              <tr>
                {["サロン", "機種", "役割", "インセンティブ", "入金日", "ステータス"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    この月の担当案件はありません
                  </td>
                </tr>
              ) : (
                currentRows.map((r) => (
                  <tr key={`${r.id}-${r.role}`}>
                    <td className="px-3 py-2">{r.salon_name}</td>
                    <td className="px-3 py-2">{r.machine_type}</td>
                    <td className="px-3 py-2">{r.role_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatYen(r.amount)}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {r.payment_date ? r.payment_date.slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.payment_status === "paid" ? (
                        <span className="text-emerald-700 dark:text-emerald-400">確定（全額入金）</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">入金待ち・未確定</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          今月のあなたの合計: {formatYen(monthTotal)}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">過去3ヶ月の合計</h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {props.months.slice(0, 4).map((m) => {
            const k = monthKey(m.year, m.month);
            const rows = byMonth.get(k) ?? [];
            const t = rows.reduce((a, r) => a + r.amount, 0);
            return (
              <li key={k} className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-800/80">
                <span>{ymLabel(m.year, m.month)}</span>
                <span className="tabular-nums">{formatYen(t)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
