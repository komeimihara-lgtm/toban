"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Company, ExpenseType } from "@/types/index";
import type { ExpenseAuditResult } from "@/types/expense-audit";
import { EXPENSE_CLAIM_KINDS } from "@/lib/expense-ui";
import Link from "next/link";
import { Camera, Loader2, Upload } from "lucide-react";

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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);

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
            const rideRaw = String(fd.get("ride_hour_local") ?? "").trim();
            const rideN =
              rideRaw === "" ? null : Math.max(0, Math.min(23, Math.floor(Number(rideRaw))));
            const res = await fetch("/api/expenses/audit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                persist: false,
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
                  ride_hour_local:
                    rideN != null && Number.isFinite(rideN) ? rideN : null,
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

  const fillFormFromOcr = useCallback(
    (data: { date?: string | null; amount?: number | null; vendor?: string | null; category?: string | null }) => {
      const form = formRef.current;
      if (!form) return;
      if (data.date) {
        const el = form.querySelector<HTMLInputElement>('[name="paid_date"]');
        if (el) {
          el.value = data.date;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      if (data.amount != null && data.amount > 0) {
        setAmountStr(String(data.amount));
      }
      if (data.vendor) {
        const el = form.querySelector<HTMLInputElement>('[name="vendor"]');
        if (el) {
          el.value = data.vendor;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      if (data.category) {
        const cat = data.category;
        const match =
          categoryLabels.find((c) => c === cat) ??
          categoryLabels.find((c) => c.includes(cat) || cat.includes(c));
        if (match) setCategory(match);
      }
    },
    [categoryLabels],
  );

  async function onFilePick(files: FileList | null) {
    const f = files?.[0];
    setReceiptLabel(f ? `${f.name}（${Math.round(f.size / 1024)} KB）` : null);
    if (!f || !f.type.startsWith("image/")) return;

    setOcrLoading(true);
    setOcrMsg(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const res = await fetch("/api/expenses/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: f.type }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          date?: string | null;
          amount?: number | null;
          vendor?: string | null;
          category?: string | null;
        };
        fillFormFromOcr(data);
        setOcrMsg("読み取り完了 — フォームに自動入力しました");
      } else {
        setOcrMsg("読み取りに失敗しました。手動で入力してください");
      }
    } catch {
      setOcrMsg("通信エラー。手動で入力してください");
    } finally {
      setOcrLoading(false);
    }
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
      const rideSubmitRaw = String(fd.get("ride_hour_local") ?? "").trim();
      const rideSubmit =
        rideSubmitRaw === ""
          ? undefined
          : Math.max(0, Math.min(23, Math.floor(Number(rideSubmitRaw))));
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
        ...(rideSubmit != null && Number.isFinite(rideSubmit)
          ? { ride_hour_local: rideSubmit }
          : {}),
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

  const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-400";

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
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
            <span className="rounded-full bg-zinc-200 px-2 py-1 font-medium text-zinc-900 dark:bg-zinc-600 dark:text-zinc-50">
              完了
            </span>
          </>
        ) : null}
      </div>

      <div className="space-y-3">
        <input
          ref={fileCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFilePick(e.target.files)}
        />
        <input
          ref={filePickRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => void onFilePick(e.target.files)}
        />
        <button
          type="button"
          disabled={ocrLoading}
          onClick={() => fileCameraRef.current?.click()}
          className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-emerald-500 text-white shadow-md transition hover:bg-emerald-400 active:scale-[0.98] active:brightness-95 disabled:opacity-60"
        >
          {ocrLoading ? (
            <Loader2 className="h-16 w-16 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-16 w-16" strokeWidth={1.65} aria-hidden />
          )}
          <span className="text-2xl font-bold tracking-tight">
            {ocrLoading ? "AIが読み取り中…" : "レシートを撮影"}
          </span>
          <span className="text-sm font-normal opacity-90">
            {ocrLoading ? "しばらくお待ちください" : "撮影してAIが自動入力"}
          </span>
        </button>
        <button
          type="button"
          disabled={ocrLoading}
          onClick={() => filePickRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Upload className="size-4" aria-hidden />
          ファイルから選択
        </button>
        {receiptLabel && (
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
            選択中: {receiptLabel}
          </p>
        )}
        {ocrMsg && (
          <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {ocrMsg}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">承認フロー</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{flowDescription}</p>
      </div>

      <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">申請種別</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPENSE_CLAIM_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-lg border px-2 py-2 text-left text-xs font-medium ${
                  kind === k.id
                    ? "border-emerald-600 bg-emerald-100 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50"
                    : "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">支払日 *</span>
            <input name="paid_date" type="date" required className={`${fieldClass} tabular-nums`} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">金額（税込）*</span>
            <input
              name="amount"
              type="number"
              min={1}
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={`${fieldClass} tabular-nums`}
            />
            {tax ? (
              <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-300">
                消費税（10%・税込から逆算）: 税抜目安 {tax.net.toLocaleString("ja-JP")}{" "}
                円 / 税額 {tax.t.toLocaleString("ja-JP")} 円
              </span>
            ) : null}
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">カテゴリ *</span>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
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
          <span className="font-medium text-zinc-800 dark:text-zinc-200">支払先 *</span>
          <input name="vendor" required className={fieldClass} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">区間（出発）</span>
            <input name="from_location" className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">区間（到着）</span>
            <input name="to_location" className={fieldClass} />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            タクシー等の利用時刻（任意・0〜23）
          </span>
          <input
            name="ride_hour_local"
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            step={1}
            placeholder="例: 14（未入力だと時刻に基づくタクシー審査は限定的）"
            className={`${fieldClass} tabular-nums`}
          />
          <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-300">
            22時以降は深夜帯としてタクシーを寛容判定します。日中の高額タクシーは注意事項になります。
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">参加者</span>
          <input name="attendees" className={fieldClass} />
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
                  className={`${fieldClass} tabular-nums`}
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
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">主な訪問先</span>
                <input
                  name="activity_client_names"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">エリア</span>
                <input
                  name="activity_area"
                  placeholder="例: 福岡市内"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
            </div>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">用途 *</span>
          <textarea name="purpose" required rows={3} className={fieldClass} />
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
                {audit.issues.length > 0 ? (
                  <details className="mt-3 rounded-lg border border-zinc-200/80 bg-white/50 p-3 dark:border-zinc-600 dark:bg-zinc-900/40">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      確認事項（{audit.issues.length} 件）
                    </summary>
                    <ul className="mt-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {audit.issues.map((iss, i) => (
                        <li key={`${iss.type}-${i}`}>
                          <span
                            className={
                              iss.severity === "error"
                                ? "text-red-700 dark:text-red-400"
                                : iss.severity === "warning"
                                  ? "text-amber-800 dark:text-amber-300"
                                  : "text-zinc-600 dark:text-zinc-400"
                            }
                          >
                            [{iss.severity}] {iss.message}
                          </span>
                          {iss.saving_amount != null && iss.saving_amount > 0 ? (
                            <span className="ml-1 text-emerald-700 dark:text-emerald-400">
                              （節約目安 ¥{iss.saving_amount.toLocaleString("ja-JP")}）
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
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
                      className="rounded-lg border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
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
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            下書き保存
          </button>
        </div>
      </form>

      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        <Link href="/my/expenses" className="font-medium text-blue-600 underline dark:text-blue-400">
          一覧へ
        </Link>
      </p>
    </div>
  );
}
