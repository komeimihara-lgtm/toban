"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Printer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PayslipApiOk = {
  ok: true;
  year: number;
  month: number;
  payroll: {
    pay_date?: string;
    base_salary?: number;
    commuting_allowance?: number;
    fixed_overtime_pay?: number;
    excess_overtime_pay?: number;
    total_payment_amount?: number;
    health_insurance_amount?: number;
    welfare_pension_amount?: number;
    employment_insurance_amount?: number;
    income_tax_amount?: number;
    inhabitant_tax_amount?: number;
    total_deduction_amount?: number;
    net_payment_amount?: number;
  } | null;
  deemed_ot: {
    allotted_hours: number;
    actual_hours: number;
    late_night_hours: number;
    holiday_hours: number;
    excess_hours: number;
    remaining_hours: number;
    consumption_pct: number;
    status: "ok" | "warn" | "over";
    monthly_amount: number;
    excess_pay: number;
    hourly_rate: number;
  };
  paid_leave: { used_days: number; remaining_days: number };
};

type PayslipApiErr = {
  ok: false;
  error?: string;
  needs_oauth?: boolean;
  needs_mapping?: boolean;
  /** FREEE_COMPANY_ID 未設定など（利用者向けは「準備中」表示） */
  preparing?: boolean;
};

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PayslipPortal() {
  const initial = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [data, setData] = useState<PayslipApiOk | null>(null);
  const [err, setErr] = useState<PayslipApiErr | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const r = await fetch(
        `/api/payslip?year=${year}&month=${month}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as PayslipApiOk | PayslipApiErr;
      if (!j.ok) {
        setErr(j);
        return;
      }
      setData(j);
    } catch (e) {
      setErr({
        ok: false,
        error: e instanceof Error ? e.message : "読み込みに失敗しました",
      });
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const statusLabel =
    data?.deemed_ot.status === "over"
      ? "超過"
      : data?.deemed_ot.status === "warn"
        ? "注意"
        : "良好";

  return (
    <div id="payslip-print-root" className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            給与明細・みなし残業
          </h1>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-card dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Printer className="size-4" aria-hidden />
            印刷・PDF保存
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-card dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="前月"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
            {year}年{month}月
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-card dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="翌月"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      {loading && (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      )}

      {!loading && err?.needs_oauth && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">freee との接続が必要です</p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
            管理者アカウントで OAuth 認証を行ってください。
          </p>
          <a
            href="/api/freee/auth"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            freee と連携する
            <ExternalLink className="size-3.5 opacity-80" />
          </a>
        </div>
      )}

      {!loading && err?.needs_mapping && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm dark:border-zinc-700 dark:bg-card">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            freee の従業員IDが未設定です
          </p>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            データベースの{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-card/80">
              profiles.freee_employee_id
            </code>{" "}
            に、freee 人事労務の数値の従業員IDを登録してください。
          </p>
          <Link
            href="/my/profile"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline dark:text-blue-400"
          >
            プロフィール設定へ
          </Link>
        </div>
      )}

      {!loading && err?.preparing && (
        <div className="rounded-xl bg-zinc-900/50 p-8 text-center mt-8">
          <p className="text-sm text-zinc-400">給与明細は準備中です。</p>
        </div>
      )}

      {!loading &&
        err &&
        !err.needs_oauth &&
        !err.needs_mapping &&
        !err.preparing && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {err.error ?? "エラーが発生しました"}
          </p>
        )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card">
            <div className="bg-zinc-900 px-5 py-4 text-white">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                LENARD
              </p>
              <p className="mt-1 text-lg font-light text-white">
                {data.year}年{data.month}月分
              </p>
              {data.payroll?.pay_date && (
                <p className="mt-2 text-xs text-zinc-300">
                  支給日 {data.payroll.pay_date}
                </p>
              )}
            </div>
            <div className="space-y-1 px-4 py-4 text-sm">
              <p className="text-xs font-semibold tracking-wide text-zinc-500">
                支給
              </p>
              {data.payroll ? (
                <>
                  <Row
                    label="基本給"
                    value={formatYen(data.payroll.base_salary ?? 0)}
                  />
                  <Row
                    label="通勤手当"
                    value={formatYen(data.payroll.commuting_allowance ?? 0)}
                  />
                  <Row
                    label="固定残業代"
                    value={formatYen(data.payroll.fixed_overtime_pay ?? 0)}
                  />
                  <Row
                    label="超過残業"
                    value={formatYen(data.payroll.excess_overtime_pay ?? 0)}
                  />
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <Row
                      label="支給合計"
                      value={formatYen(
                        data.payroll.total_payment_amount ?? 0,
                      )}
                      bold
                    />
                  </div>
                  <p className="pt-3 text-xs font-semibold tracking-wide text-zinc-500">
                    控除
                  </p>
                  <DedRow
                    label="健康保険"
                    amount={data.payroll.health_insurance_amount ?? 0}
                  />
                  <DedRow
                    label="厚生年金"
                    amount={data.payroll.welfare_pension_amount ?? 0}
                  />
                  <DedRow
                    label="雇用保険"
                    amount={data.payroll.employment_insurance_amount ?? 0}
                  />
                  <DedRow
                    label="所得税"
                    amount={data.payroll.income_tax_amount ?? 0}
                  />
                  <DedRow
                    label="住民税"
                    amount={data.payroll.inhabitant_tax_amount ?? 0}
                  />
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <DedRow
                      label="控除合計"
                      amount={data.payroll.total_deduction_amount ?? 0}
                    />
                  </div>
                  <div className="mt-3 border-t-2 border-zinc-300 pt-3 dark:border-zinc-600">
                    <Row
                      label="手取り"
                      value={formatYen(
                        data.payroll.net_payment_amount ?? 0,
                      )}
                      boldLarge
                    />
                  </div>
                </>
              ) : (
                <p className="text-zinc-500">
                  この月の給与明細は freee にありません（または未取得）
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white dark:from-zinc-950 dark:to-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    みなし残業
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    実績 {data.deemed_ot.actual_hours}h / みなし{" "}
                    {data.deemed_ot.allotted_hours}h
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    data.deemed_ot.status === "over"
                      ? "bg-red-500/20 text-red-200"
                      : data.deemed_ot.status === "warn"
                        ? "bg-amber-500/20 text-amber-100"
                        : "bg-emerald-500/20 text-emerald-100"
                  }`}
                >
                  {statusLabel} · 消化{data.deemed_ot.consumption_pct}%
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.deemed_ot.status === "over"
                      ? "bg-red-400"
                      : data.deemed_ot.status === "warn"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{
                    width: `${Math.min(100, data.deemed_ot.consumption_pct)}%`,
                  }}
                />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-light tabular-nums">
                    {data.deemed_ot.remaining_hours}
                    <span className="text-xs text-zinc-500">h</span>
                  </p>
                  <p className="text-[10px] text-zinc-500">残みなし</p>
                </div>
                <div>
                  <p className="text-2xl font-light tabular-nums text-amber-200">
                    {data.deemed_ot.excess_hours}
                    <span className="text-xs text-zinc-500">h</span>
                  </p>
                  <p className="text-[10px] text-zinc-500">超過</p>
                </div>
                <div>
                  <p className="text-2xl font-light tabular-nums text-red-200">
                    {formatYen(data.deemed_ot.excess_pay)}
                  </p>
                  <p className="text-[10px] text-zinc-500">超過分（概算）</p>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
                深夜 {data.deemed_ot.late_night_hours}h · 休日{" "}
                {data.deemed_ot.holiday_hours}h · 固定残業代ベース{" "}
                {formatYen(data.deemed_ot.monthly_amount)}（時給換算{" "}
                {formatYen(data.deemed_ot.hourly_rate)}）
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
              <p className="text-xs font-semibold tracking-wide text-zinc-500">
                有給（freee サマリー）
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-3xl font-light tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.paid_leave.used_days}
                  </p>
                  <p className="text-xs text-zinc-500">取得日数</p>
                </div>
                <div>
                  <p className="text-3xl font-light tabular-nums text-emerald-600 dark:text-emerald-400">
                    {data.paid_leave.remaining_days}
                  </p>
                  <p className="text-xs text-zinc-500">残日数</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  boldLarge,
}: {
  label: string;
  value: string;
  bold?: boolean;
  boldLarge?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span
        className={`font-mono tabular-nums text-zinc-900 dark:text-zinc-100 ${bold ? "font-medium" : ""} ${boldLarge ? "text-lg font-semibold text-emerald-700 dark:text-emerald-400" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function DedRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-mono tabular-nums text-red-600 dark:text-red-400">
        −{formatYen(amount)}
      </span>
    </div>
  );
}
