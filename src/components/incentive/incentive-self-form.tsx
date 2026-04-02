"use client";

import {
  saveSimpleIncentiveDraft,
  submitSimpleIncentive,
} from "@/app/actions/incentive-actions";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type MyIncentiveSubmission = {
  id: string;
  sales_amount: number | null;
  status: string;
  submitted_at: string | null;
  rate_snapshot: number | null;
} | null;

type Props = {
  yearMonth: string;
  rate: number;
  formulaType: string;
  submission: MyIncentiveSubmission;
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

function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, "");
}

export function IncentiveSelfForm({
  yearMonth,
  rate,
  formulaType,
  submission,
  history,
}: Props) {
  const locked =
    submission?.status === "submitted" || submission?.status === "approved";

  const [rawSales, setRawSales] = useState(() =>
    submission?.sales_amount != null && Number.isFinite(Number(submission.sales_amount))
      ? String(Math.round(Number(submission.sales_amount)))
      : "",
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const salesNum = useMemo(
    () => Math.max(0, Number(rawSales.replace(/,/g, "")) || 0),
    [rawSales],
  );

  const effectiveRate =
    locked && submission?.rate_snapshot != null
      ? Number(submission.rate_snapshot)
      : rate;

  const estimatedPayout = useMemo(() => {
    if (formulaType !== "fixed_rate" || !Number.isFinite(effectiveRate)) return 0;
    return Math.floor(salesNum * effectiveRate);
  }, [formulaType, effectiveRate, salesNum]);

  const ratePercent = effectiveRate * 100;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (locked) return;

    startTransition(async () => {
      const res = await submitSimpleIncentive({
        yearMonth,
        salesAmount: salesNum,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onSaveDraft() {
    setError(null);
    if (locked) return;
    startTransition(async () => {
      const res = await saveSimpleIncentiveDraft({
        yearMonth,
        salesAmount: salesNum,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  const displayPayout =
    locked && submission?.sales_amount != null && submission.rate_snapshot != null
      ? Math.floor(Number(submission.sales_amount) * Number(submission.rate_snapshot))
      : estimatedPayout;

  const salesForDisplay = locked && submission?.sales_amount != null
    ? Math.max(0, Number(submission.sales_amount))
    : salesNum;

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          マイインセンティブ
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          自分の今月（{yearMonth}）の売上のみ入力できます。他の社員のデータは表示されません。
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500">あなたの適用率（incentive_rates）</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {ratePercent.toLocaleString("ja-JP", { maximumFractionDigits: 4 })}%
            <span className="ml-2 text-sm font-normal text-zinc-500">
              · {formulaType}
            </span>
          </p>
          {locked && submission?.rate_snapshot != null && (
            <p className="mt-1 text-xs text-zinc-500">
              提出時点の率: {(Number(submission.rate_snapshot) * 100).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}%
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="my_sales_amount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              今月の売上実績（円）
            </label>
            <input
              id="my_sales_amount"
              type="text"
              inputMode="numeric"
              disabled={locked || pending}
              value={rawSales}
              onChange={(e) => setRawSales(digitsOnly(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="0"
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              インセンティブ試算（リアルタイム）
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
              {formatYen(displayPayout)}
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              売上 {formatYen(salesForDisplay)} × 率（端数切り捨て）
              {formulaType !== "fixed_rate" && " — fixed_rate 以外は管理画面の計算ルールに従います"}
            </p>
          </div>

          {submission?.status === "draft" && (
            <p className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-200">
              下書き保存済みです。「提出する」で送信してください。
            </p>
          )}

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

          {submission?.status === "rejected" && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              差戻しされました。内容を修正して再提出できます。
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={locked || pending}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {pending ? "保存中…" : "下書き保存"}
            </button>
            <button
              type="submit"
              disabled={locked || pending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "送信中…" : "提出する"}
            </button>
          </div>
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
              const base = row.sales_amount ?? 0;
              const r = row.rate_snapshot ?? 0;
              const pay = Math.floor(base * r);
              return (
                <li
                  key={row.year_month}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {row.year_month}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    売上 {formatYen(base)} · 支給 {formatYen(pay)}
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
