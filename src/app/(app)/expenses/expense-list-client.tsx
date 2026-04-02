"use client";

import { useCallback, useMemo, useState } from "react";

type ExpenseRow = {
  id: string;
  type: string;
  status: string;
  category: string;
  amount: number;
  paid_date: string;
  purpose: string;
  vendor: string | null;
  submitter_name: string | null;
  created_at: string;
  receipt_url: string | null;
  auto_approved?: boolean | null;
  audit_score?: number | null;
};

function isReceiptMissing(r: ExpenseRow) {
  if (r.status === "draft" || r.status === "rejected") return false;
  const url = r.receipt_url?.trim() ?? "";
  return url.length === 0;
}

const TABS = [
  { id: "", label: "全件" },
  { id: "draft", label: "下書き" },
  { id: "step1_pending", label: "第1承認待ち" },
  { id: "step2_pending", label: "最終承認待ち" },
  { id: "approved", label: "承認済" },
  { id: "rejected", label: "差戻し" },
];

export function ExpenseListClient({ initialRows }: { initialRows: ExpenseRow[] }) {
  const [tab, setTab] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!tab) return initialRows;
    return initialRows.filter((r) => r.status === tab);
  }, [initialRows, tab]);

  const exportCsv = useCallback(() => {
    const headers = [
      "id",
      "status",
      "type",
      "category",
      "amount",
      "paid_date",
      "vendor",
      "purpose",
      "submitter_name",
      "created_at",
      "receipt_url",
    ];
    const lines = [
      headers.join(","),
      ...filtered.map((r) =>
        headers
          .map((h) => {
            const v = r[h as keyof ExpenseRow];
            const s = v == null ? "" : String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
        >
          CSV出力
        </button>
      </div>

      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpenId((id) => (id === r.id ? null : r.id))}
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium">{r.category}</span>
                <span className="tabular-nums">
                  {new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(
                    Number(r.amount),
                  )}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{r.submitter_name ?? "—"}</span>
                <span>{r.status}</span>
                <span>{r.paid_date}</span>
                {r.vendor ? <span>{r.vendor}</span> : null}
                {r.status === "approved" && r.auto_approved ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                    ✓ 自動承認されました
                  </span>
                ) : null}
                {r.status === "step1_pending" &&
                (r.audit_score == null || r.audit_score === undefined) ? (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-900 dark:text-violet-200">
                    AI審査中…
                  </span>
                ) : null}
                {r.status === "step1_pending" && r.audit_score != null ? (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-900 dark:text-sky-200">
                    承認待ち（千葉さんに通知済み）
                  </span>
                ) : null}
                {isReceiptMissing(r) ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300">
                    領収書未添付
                  </span>
                ) : null}
              </div>
            </button>
            {openId === r.id && (
              <div className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="text-xs text-zinc-500">ID: {r.id}</p>
                {r.vendor ? (
                  <p className="mt-1 text-xs text-zinc-600">支払先: {r.vendor}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap">{r.purpose}</p>
                <p className="mt-2 text-xs">種別: {r.type}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-zinc-500">該当する申請がありません</p>}
    </div>
  );
}
