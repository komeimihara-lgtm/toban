"use client";

import type { ExpenseAuditResult } from "@/types/expense-audit";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  status: string;
  category: string;
  amount: number;
  purpose: string;
  submitter_name: string | null;
  paid_date: string;
  audit_score: number | null;
  audit_result: unknown | null;
  audit_at: string | null;
};

function asAuditResult(raw: unknown): ExpenseAuditResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.score !== "number" || !Array.isArray(o.issues)) return null;
  return raw as ExpenseAuditResult;
}

export function ExpenseV2Approval({
  rows,
  role,
}: {
  rows: Row[];
  role: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectModalFor, setRejectModalFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [auditBusy, setAuditBusy] = useState<string | null>(null);

  async function approve(id: string, action: "step1" | "step2") {
    setBusy(id);
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        alert(j.error ?? "エラー");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      alert("理由を入力してください");
      return;
    }
    setBusy(id);
    try {
      const res = await fetch(`/api/expenses/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        alert(j.error ?? "エラー");
        return;
      }
      setRejectModalFor(null);
      setReason("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runAudit(id: string) {
    setAuditBusy(id);
    try {
      const res = await fetch("/api/expenses/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense_id: id, persist: true }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        alert(j.error ?? "審査に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setAuditBusy(null);
    }
  }

  async function bulkApprove(action: "step1" | "step2") {
    const targets = rows.filter((r) =>
      action === "step1" ? r.status === "step1_pending" : r.status === "step2_pending",
    );
    if (targets.length === 0) return;
    if (!confirm(`${targets.length} 件を一括承認しますか？`)) return;
    setBulkBusy(true);
    try {
      for (const t of targets) {
        const res = await fetch(`/api/expenses/${t.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          alert(j.error ?? "エラー");
          break;
        }
      }
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-zinc-500">新ワークフロー（expenses）の承認待ちはありません</p>
    );
  }

  const showStep2 = role === "owner";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {role === "approver" && (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void bulkApprove("step1")}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            第1承認を一括
          </button>
        )}
        {showStep2 && (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void bulkApprove("step2")}
            className="rounded bg-emerald-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            最終承認を一括
          </button>
        )}
      </div>

      <ul className="space-y-4">
        {rows.map((row) => {
          const ar = asAuditResult(row.audit_result);
          const sc = row.audit_score ?? ar?.score ?? null;
          const badgeClass =
            sc == null
              ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              : sc >= 80
                ? "bg-emerald-600 text-white"
                : sc >= 50
                  ? "bg-amber-500 text-white"
                  : "bg-red-600 text-white";
          return (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${badgeClass}`}
                >
                  AI {sc != null ? `${sc} 点` : "未審査"}
                </span>
                {row.audit_at && (
                  <span className="text-xs text-zinc-500">
                    審査:{" "}
                    {new Date(row.audit_at).toLocaleString("ja-JP", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
                <button
                  type="button"
                  disabled={auditBusy === row.id}
                  onClick={() => void runAudit(row.id)}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                >
                  {auditBusy === row.id ? "審査中…" : "AI審査を更新"}
                </button>
              </div>
              {ar && ar.issues.length > 0 ? (
                <details className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    確認事項（{ar.issues.length} 件）
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {ar.issues.map((iss, i) => (
                      <li key={`${iss.type}-${i}`}>
                        <span
                          className={
                            iss.severity === "error"
                              ? "text-red-700 dark:text-red-400"
                              : iss.severity === "warning"
                                ? "text-amber-800 dark:text-amber-300"
                                : ""
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
              {ar ? (
                <details className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/40">
                  <summary className="cursor-pointer text-xs font-medium text-violet-800 dark:text-violet-200">
                    AIの審査詳細を見る（サマリー・改善提案）
                  </summary>
                  <p className="mt-2 font-medium text-violet-950 dark:text-violet-100">
                    サマリー
                  </p>
                  <p className="mt-1 text-violet-900 dark:text-violet-200">{ar.summary}</p>
                  {ar.suggestions.length > 0 ? (
                    <>
                      <p className="mt-3 text-xs font-medium text-violet-950 dark:text-violet-100">
                        改善提案
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-violet-900 dark:text-violet-200">
                        {ar.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </details>
              ) : null}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="rounded-full bg-zinc-200 px-2.5 py-1 font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    申請者
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      row.status === "step1_pending"
                        ? "bg-amber-100 text-amber-950 ring-2 ring-amber-500 dark:bg-amber-950/60 dark:text-amber-100"
                        : "bg-emerald-600 text-white dark:bg-emerald-600"
                    }`}
                  >
                    第1 千葉
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      row.status === "step2_pending"
                        ? "bg-amber-100 text-amber-950 ring-2 ring-amber-500 dark:bg-amber-950/60 dark:text-amber-100"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800"
                    }`}
                  >
                    最終 三原孔明
                  </span>
                </div>
              </div>

              <p className="font-medium">
                {row.category} —{" "}
                {new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(
                  Number(row.amount),
                )}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {row.submitter_name} / {row.paid_date}
              </p>
              <p className="mt-2 text-sm">{row.purpose}</p>
              <p className="mt-1 text-xs text-zinc-500">ステータス: {row.status}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {row.status === "step1_pending" && role === "approver" && (
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void approve(row.id, "step1")}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    第1承認
                  </button>
                )}
                {row.status === "step2_pending" && showStep2 && (
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void approve(row.id, "step2")}
                    className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    最終承認
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => {
                    setRejectModalFor(row.id);
                    setReason("");
                  }}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 dark:border-red-800 dark:text-red-200"
                >
                  差戻し
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {rejectModalFor ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
            <h2 id="reject-title" className="text-sm font-semibold">
              差戻し理由
            </h2>
            <p className="mt-1 text-xs text-zinc-500">申請者へ通知されます。</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="必須"
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              rows={4}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                onClick={() => setRejectModalFor(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={busy === rejectModalFor}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                onClick={() => void reject(rejectModalFor)}
              >
                差戻す
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
