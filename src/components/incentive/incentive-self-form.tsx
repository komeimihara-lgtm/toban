"use client";

import { submitIncentiveSales } from "@/app/actions/incentive-actions";
import type { IncentiveSubmissionRow } from "@/types/incentive";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  yearMonth: string;
  rate: number;
  formulaType: string;
  submission: Pick<
    IncentiveSubmissionRow,
    "id" | "sales_amount" | "status" | "submitted_at" | "rate_snapshot"
  > | null;
  history: {
    year_month: string;
    sales_amount: number | null;
    rate_snapshot: number | null;
    status: string;
  }[];
};

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function IncentiveSelfForm({
  yearMonth,
  rate,
  formulaType,
  submission,
  history,
}: Props) {
  const [rawSales, setRawSales] = useState(() =>
    submission?.sales_amount != null ? String(submission.sales_amount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const locked =
    submission?.status === "submitted" || submission?.status === "approved";

  const salesNum = useMemo(() => {
    const n = Number(rawSales.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [rawSales]);

  const estimatedPayout = useMemo(() => {
    if (formulaType !== "fixed_rate" || !Number.isFinite(rate)) return 0;
    return Math.floor(salesNum * rate);
  }, [formulaType, rate, salesNum]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (locked) return;

    startTransition(async () => {
      const res = await submitIncentiveSales(salesNum, yearMonth);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  const ratePercent = rate * 100;

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          マイインセンティブ
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          対象月: {yearMonth}
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          今月の売上
        </h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">インセンティブ率</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {ratePercent.toLocaleString("ja-JP", {
                maximumFractionDigits: 4,
              })}
              %（{formulaType}）
            </dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="sales_amount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              今月の売上実績（円）
            </label>
            <input
              id="sales_amount"
              name="sales_amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={locked || pending}
              value={rawSales}
              onChange={(e) =>
                setRawSales(e.target.value.replace(/[^\d]/g, ""))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="0"
            />
          </div>

          <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              試算インセンティブ
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatYen(estimatedPayout)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              売上 × 率（端数切り捨て）
            </p>
          </div>

          {submission?.status === "submitted" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              提出済みです。承認待ちのため編集できません。
            </p>
          )}

          {submission?.status === "approved" && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              承認済みのため編集できません。
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={locked || pending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "送信中…" : "提出する"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          過去3ヶ月の支給履歴（承認済み）
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            承認済みの履歴はまだありません。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {history.map((row) => {
              const s = row.sales_amount ?? 0;
              const r = row.rate_snapshot ?? 0;
              const pay = Math.floor(s * r);
              return (
                <li
                  key={row.year_month}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {row.year_month}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    売上 {formatYen(s)} · 支給 {formatYen(pay)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
