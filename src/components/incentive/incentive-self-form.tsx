"use client";

import {
  saveIncentiveDraft,
  submitIncentiveSales,
} from "@/app/actions/incentive-actions";
import type { IncentiveSubmissionRow } from "@/types/incentive";
import {
  computeNetProfitExTax,
  INCENTIVE_DEAL_ROLE_LABEL,
  type IncentiveDealRole,
} from "@/types/incentive";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type ProductRow = {
  id: string;
  name: string;
  cost_price: number;
};

type Props = {
  yearMonth: string;
  rate: number;
  formulaType: string;
  submission: Pick<
    IncentiveSubmissionRow,
    | "id"
    | "sales_amount"
    | "status"
    | "submitted_at"
    | "rate_snapshot"
    | "selling_price_tax_in"
    | "actual_cost"
    | "service_cost_deduction"
    | "deal_role"
    | "net_profit_ex_tax"
    | "product_id"
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

const DEAL_ROLES: IncentiveDealRole[] = ["appo", "closer"];

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
  const initialRole: IncentiveDealRole =
    submission?.deal_role === "closer" ? "closer" : "appo";

  const [dealRole, setDealRole] = useState<IncentiveDealRole>(initialRole);
  const [rawSelling, setRawSelling] = useState(() =>
    submission?.selling_price_tax_in != null
      ? String(Math.round(submission.selling_price_tax_in))
      : "",
  );
  const [rawActual, setRawActual] = useState(() =>
    submission?.actual_cost != null
      ? String(Math.round(submission.actual_cost))
      : "",
  );
  const [rawService, setRawService] = useState(() =>
    submission?.service_cost_deduction != null &&
    submission.service_cost_deduction > 0
      ? String(Math.round(submission.service_cost_deduction))
      : "",
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const locked =
    submission?.status === "submitted" || submission?.status === "approved";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string | null>(
    submission?.product_id ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d: { products?: ProductRow[] }) => {
        if (!cancelled) setProducts(d.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sellingNum = useMemo(
    () => Math.max(0, Number(rawSelling.replace(/,/g, "")) || 0),
    [rawSelling],
  );
  const actualNum = useMemo(
    () => Math.max(0, Number(rawActual.replace(/,/g, "")) || 0),
    [rawActual],
  );
  const serviceNum = useMemo(
    () => Math.max(0, Number(rawService.replace(/,/g, "")) || 0),
    [rawService],
  );

  const netProfit = useMemo(
    () => computeNetProfitExTax(sellingNum, actualNum, serviceNum),
    [sellingNum, actualNum, serviceNum],
  );

  const payoutBase = useMemo(() => Math.max(0, netProfit), [netProfit]);

  const estimatedPayout = useMemo(() => {
    if (formulaType !== "fixed_rate" || !Number.isFinite(rate)) return 0;
    return Math.floor(payoutBase * rate);
  }, [formulaType, rate, payoutBase]);

  const ratePercent = rate * 100;
  const roleLabel = INCENTIVE_DEAL_ROLE_LABEL[dealRole];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (locked) return;

    startTransition(async () => {
      const res = await submitIncentiveSales({
        sellingPriceTaxIn: sellingNum,
        actualCost: actualNum,
        serviceCostDeduction: serviceNum,
        dealRole,
        yearMonth,
        productId,
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
      const res = await saveIncentiveDraft({
        sellingPriceTaxIn: sellingNum,
        actualCost: actualNum,
        serviceCostDeduction: serviceNum,
        dealRole,
        yearMonth,
        productId,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  const displayNetLocked =
    locked && submission?.net_profit_ex_tax != null
      ? submission.net_profit_ex_tax
      : locked && submission?.sales_amount != null
        ? submission.sales_amount
        : null;

  const lockedPayoutBase =
    locked && submission?.sales_amount != null ? submission.sales_amount : 0;

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
          この案件での自分の役割
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
          アポ・クローザーから選択してください。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEAL_ROLES.map((r) => {
            const selected = dealRole === r;
            return (
              <button
                key={r}
                type="button"
                disabled={locked || pending}
                onClick={() => setDealRole(r)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {selected && <Check className="size-4 shrink-0" aria-hidden />}
                {INCENTIVE_DEAL_ROLE_LABEL[r]}
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="mt-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          商品マスタ
        </h2>
        <div>
          <label
            htmlFor="product_select"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            商品（選択で実質原価に原価を自動入力／手編集可）
          </label>
          <select
            id="product_select"
            disabled={locked || pending}
            value={productId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setProductId(v || null);
              const p = products.find((x) => x.id === v);
              if (p)
                setRawActual(
                  String(Math.max(0, Math.round(Number(p.cost_price)))),
                );
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">選択してください</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（原価 {formatYen(Number(p.cost_price))}）
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          案件の数字
        </h2>
          <div>
            <label
              htmlFor="selling_price"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              販売価格（税込・円）
            </label>
            <input
              id="selling_price"
              type="text"
              inputMode="numeric"
              disabled={locked || pending}
              value={rawSelling}
              onChange={(e) => setRawSelling(digitsOnly(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="actual_cost"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              実質原価（円）
            </label>
            <input
              id="actual_cost"
              type="text"
              inputMode="numeric"
              disabled={locked || pending}
              value={rawActual}
              onChange={(e) => setRawActual(digitsOnly(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="service_deduction"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              サービス（原価控除）（円）
            </label>
            <input
              id="service_deduction"
              type="text"
              inputMode="numeric"
              disabled={locked || pending}
              value={rawService}
              onChange={(e) => setRawService(digitsOnly(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <p className="mt-1 text-xs text-zinc-500">
              純利益から差し引くサービス系の原価控除分です。
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              純利益（税抜）
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {locked && displayNetLocked != null
                ? formatYen(displayNetLocked)
                : formatYen(Math.floor(netProfit))}
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              販売価格 ÷ 1.1 − 実質原価 − サービス（原価控除）
            </p>
          </div>

          <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              インセンティブ試算
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              役割: <span className="font-medium">{roleLabel}</span>
              ／個人設定率{" "}
              {ratePercent.toLocaleString("ja-JP", {
                maximumFractionDigits: 4,
              })}
              %（{formulaType}）
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              合計:{" "}
              {formatYen(
                locked
                  ? Math.floor(
                      lockedPayoutBase * (submission?.rate_snapshot ?? rate),
                    )
                  : estimatedPayout,
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              max(0, 純利益税抜) × 率（端数切り捨て）。役割はアポ・クローザーのみです。
            </p>
          </div>

          {submission?.status === "draft" && (
            <p className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-200">
              下書きを保存済みです。内容を確認のうえ「提出する」で送信してください。
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
                    純利益（基準） {formatYen(base)} · 支給 {formatYen(pay)}
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
