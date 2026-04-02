"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Company, ExpenseType } from "@/types/index";
import type { ExpenseAuditResult } from "@/types/expense-audit";
import { EXPENSE_CLAIM_KINDS } from "@/lib/expense-ui";
import Link from "next/link";
import { Camera, Upload } from "lucide-react";

const TYPE_MAP: Record<string, ExpenseType> = {
  expense: "expense",
  travel: "travel",
  advance: "advance",
  advance_settle: "advance_settle",
};

function isTravelishCategory(category: string) {
  const c = category.trim();
  return (
    c === "交通費" ||
    c.includes("交通") ||
    c.includes("出張") ||
    c.includes("宿泊")
  );
}

function readActivityFields(fd: FormData) {
  const v = String(fd.get("activity_visit_count") ?? "").trim();
  const m = String(fd.get("activity_meeting_count") ?? "").trim();
  const visit = v === "" ? null : Math.max(0, Math.floor(Number(v)));
  const meet = m === "" ? null : Math.max(0, Math.floor(Number(m)));
  const area = String(fd.get("activity_area") ?? "").trim();
  const clients = String(fd.get("activity_client_names") ?? "").trim();
  return {
    activity_visit_count:
      visit != null && Number.isFinite(visit) ? visit : null,
    activity_meeting_count:
      meet != null && Number.isFinite(meet) ? meet : null,
    activity_area: area || null,
    activity_client_names: clients || null,
  };
}

export function ExpenseApiForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const filePickRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("expense");
  const [amountStr, setAmountStr] = useState("");
  const [receiptLabel, setReceiptLabel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryLabels, setCategoryLabels] = useState<string[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [audit, setAudit] = useState<ExpenseAuditResult | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [proceedDespiteAudit, setProceedDespiteAudit] = useState(false);
  const [isSalesTarget, setIsSalesTarget] = useState(false);
  const [category, setCategory] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      setCtxError(null);
      try {
        const res = await fetch("/api/company/context");
        const j = (await res.json()) as {
          error?: string;
          company?: Company;
          expense_categories?: { label: string }[];
          viewer?: { is_sales_target?: boolean };
        };
        if (!res.ok) {
          if (!cancelled) setCtxError(j.error ?? "コンテキスト取得に失敗しました");
          return;
        }
        if (!cancelled) {
          setCompany(j.company ?? null);
          setCategoryLabels((j.expense_categories ?? []).map((c) => c.label));
          setIsSalesTarget(Boolean(j.viewer?.is_sales_target));
        }
      } catch {
        if (!cancelled) setCtxError("通信エラー");
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form || ctxLoading) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          const fd = new FormData(form);
          const category = String(fd.get("category") ?? "").trim();
          const paid_date = String(fd.get("paid_date") ?? "").trim();
          const vendor = String(fd.get("vendor") ?? "").trim();
          const purpose = String(fd.get("purpose") ?? "").trim();
          const amountN = Number(fd.get("amount"));
          if (
            !category ||
            !paid_date ||
            !vendor ||
            !Number.isFinite(amountN) ||
            amountN <= 0
          ) {
            return;
          }
          setProceedDespiteAudit(false);
          if (cancelled) return;
          setAuditLoading(true);
          try {
            const act = readActivityFields(fd);
            const res = await fetch("/api/expenses/audit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expense_data: {
                  type: TYPE_MAP[kind] ?? "expense",
                  category,
                  amount: amountN,
                  paid_date,
                  vendor,
                  purpose,
                  attendees: fd.get("attendees") || null,
                  from_location: fd.get("from_location") || null,
                  to_location: fd.get("to_location") || null,
                  receipt_url: null,
                  ride_hour_local: new Date().getHours(),
                  ...act,
                },
              }),
            });
            const j = (await res.json()) as ExpenseAuditResult & { error?: string };
            if (!cancelled && res.ok && j.score != null) {
              setAudit(j);
            }
          } finally {
            if (!cancelled) setAuditLoading(false);
          }
        })();
      }, 900);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
    };
  }, [kind, ctxLoading, category, isSalesTarget]);

  const amount = Number(amountStr.replace(/,/g, ""));
  const tax = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const net = Math.round((amount / 1.1) * 100) / 100;
    const t = Math.round((amount - net) * 100) / 100;
    return { net, t };
  }, [amount]);

  function onFilePick(files: FileList | null) {
    const f = files?.[0];
    setReceiptLabel(f ? `${f.name}（${Math.round(f.size / 1024)} KB）` : null);
  }

  async function doSubmit(submit: boolean) {
    const form = formRef.current;
    if (!form) return;
    if (
      submit &&
      audit &&
      audit.score < 80 &&
      !proceedDespiteAudit
    ) {
      setMsg(
        "AI審査で確認事項があります。内容を確認するか「このまま申請する」で続行してください。",
      );
      return;
    }
    setLoading(true);
    setMsg(submit ? "AI審査・自動承認を確認しています…" : null);
    const fd = new FormData(form);
    try {
      const act = readActivityFields(fd);
      const body = {
        type: TYPE_MAP[kind] ?? "expense",
        category: fd.get("category"),
        amount: Number(fd.get("amount")),
        paid_date: fd.get("paid_date"),
        vendor: fd.get("vendor") ?? "",
        purpose: fd.get("purpose"),
        attendees: fd.get("attendees") || null,
        from_location: fd.get("from_location") || null,
        to_location: fd.get("to_location") || null,
        submit,
        ...(isSalesTarget &&
        isTravelishCategory(String(fd.get("category") ?? ""))
          ? act
          : {}),
      };
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        error?: string;
        id?: string;
        autoApproved?: boolean;
        status?: string;
      };
      if (!res.ok) {
        setMsg(j.error ?? "エラー");
        return;
      }
      if (submit) {
        if (j.autoApproved) {
          setMsg("✓ 自動承認されました。一覧からご確認ください。");
        } else if (j.status === "step1_pending") {
          setMsg("提出しました。承認待ちです（千葉さんに通知済み）。");
        } else {
          setMsg(`提出しました（id: ${j.id}）`);
        }
      } else {
        setMsg(`下書き保存しました（id: ${j.id}）`);
      }
      if (submit) {
        form.reset();
        setAmountStr("");
        setReceiptLabel(null);
        setAudit(null);
        setProceedDespiteAudit(false);
      }
    } catch {
      setMsg("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  const approvalSteps = company?.settings.approval.steps ?? [];
  const flowDescription =
    approvalSteps.length > 0
      ? `申請者 → ${approvalSteps.map((s) => s.label).join(" → ")} → 完了`
      : "申請者 → 承認 → 完了";

  return (
    <div className="space-y-6">
      {ctxError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {ctxError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          1 申請者
        </span>
        {ctxLoading && !company ? (
          <span className="self-center text-zinc-500">承認フローを読込中…</span>
        ) : (
          approvalSteps.map((s, i) => (
            <Fragment key={`${s.order}-${i}-${s.label}`}>
              <span aria-hidden className="self-center">
                →
              </span>
              <span className="rounded-full bg-zinc-200 px-2 py-1 font-medium text-zinc-700 dark:bg-zinc-300 dark:text-zinc-900">
                {i + 2} {s.label}
              </span>
            </Fragment>
          ))
        )}
        {!ctxLoading && approvalSteps.length > 0 ? (
          <>
            <span aria-hidden className="self-center">
              →
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-1 font-medium dark:bg-zinc-700">
              完了
            </span>
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6 dark:border-zinc-600 dark:bg-zinc-900/30">
        <p className="text-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
          領収書（任意・アップロード）
        </p>
        <p className="mt-1 text-center text-xs text-zinc-500">
          クラウド保存は未接続です。選択したファイル名のみ保持します（OCR は今後接続予定）。
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <input
            ref={fileCameraRef}
            type="file"
            accept="image/*,.pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => onFilePick(e.target.files)}
          />
          <input
            ref={filePickRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => onFilePick(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileCameraRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            <Camera className="size-4" aria-hidden />
            カメラで撮影
          </button>
          <button
            type="button"
            onClick={() => filePickRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            <Upload className="size-4" aria-hidden />
            ファイルを選択
          </button>
        </div>
        {receiptLabel ? (
          <p className="mt-3 text-center text-xs text-zinc-600 dark:text-zinc-400">
            選択中: {receiptLabel}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">承認フロー</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{flowDescription}</p>
      </div>

      <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <p className="text-xs font-medium text-zinc-600">申請種別</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPENSE_CLAIM_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-lg border px-2 py-2 text-left text-xs ${
                  kind === k.id
                    ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                    : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">支払日 *</span>
            <input
              name="paid_date"
              type="date"
              required
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">金額（税込）*</span>
            <input
              name="amount"
              type="number"
              min={1}
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
            {tax ? (
              <span className="mt-1 block text-xs text-zinc-500">
                消費税（10%・税込から逆算）: 税抜目安 {tax.net.toLocaleString("ja-JP")}{" "}
                円 / 税額 {tax.t.toLocaleString("ja-JP")} 円
              </span>
            ) : null}
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">カテゴリ *</span>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              {ctxLoading ? "読込中…" : categoryLabels.length ? "選択" : "カテゴリ未設定"}
            </option>
            {categoryLabels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">支払先 *</span>
          <input
            name="vendor"
            required
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">区間（出発）</span>
            <input
              name="from_location"
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">区間（到着）</span>
            <input
              name="to_location"
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">参加者</span>
          <input
            name="attendees"
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {isSalesTarget && isTravelishCategory(category) ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/35">
            <p className="text-sm font-medium text-sky-950 dark:text-sky-100">
              商談情報（任意・入力すると審査が通りやすくなります）
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">訪問件数</span>
                <input
                  name="activity_visit_count"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">商談件数（任意）</span>
                <input
                  name="activity_meeting_count"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">主な訪問先</span>
                <input
                  name="activity_client_names"
                  autoComplete="off"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">エリア</span>
                <input
                  name="activity_area"
                  placeholder="例: 福岡市内"
                  autoComplete="off"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium">用途 *</span>
          <textarea
            name="purpose"
            required
            rows={3}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {(audit || auditLoading) && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              audit && audit.score >= 80
                ? "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                : audit && audit.score >= 50
                  ? "border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/25"
                  : "border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/25"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                AI 審査（提出前）
              </span>
              {auditLoading && (
                <span className="text-xs text-zinc-500">検証中…</span>
              )}
              {audit && !auditLoading && (
                <>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                      audit.score >= 80
                        ? "bg-emerald-600 text-white"
                        : audit.score >= 50
                          ? "bg-amber-500 text-white"
                          : "bg-red-600 text-white"
                    }`}
                  >
                    {audit.score >= 80
                      ? "問題なし"
                      : audit.score >= 50
                        ? "確認事項あり"
                        : "要修正"}
                    {" · "}
                    {audit.score} 点
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {audit.verdict === "approve"
                      ? "判定: おおむね妥当"
                      : audit.verdict === "review"
                        ? "判定: 確認推奨"
                        : "判定: 内容の見直し推奨"}
                  </span>
                </>
              )}
            </div>
            {audit && !auditLoading ? (
              <>
                <p className="mt-2 text-zinc-800 dark:text-zinc-200">{audit.summary}</p>
                {audit.suggestions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                    {audit.suggestions.map((s, i) => (
                      <li key={`${i}-${s.slice(0, 32)}`}>{s}</li>
                    ))}
                  </ul>
                )}
                {audit.score < 80 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProceedDespiteAudit(true)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      このまま申請する
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        formRef.current?.querySelector<HTMLElement>("[name=purpose]")?.focus();
                      }}
                      className="rounded-lg border border-zinc-400 px-3 py-1.5 text-xs dark:border-zinc-500"
                    >
                      修正する
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void doSubmit(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            提出（第1承認へ）
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void doSubmit(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            下書き保存
          </button>
        </div>
      </form>

      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
      <p className="text-xs text-zinc-500">
        <Link href="/my/expenses" className="underline">
          一覧へ
        </Link>
      </p>
    </div>
  );
}
