"use client";

import { useState } from "react";

export function FreeeLinkPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/freee/payslips/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        year?: number;
        month?: number;
        staff_count?: number;
        results?: { ok?: boolean; error?: string }[];
      };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "同期に失敗しました");
        return;
      }
      const errors = (data.results ?? []).filter((r) => r.error).length;
      setMessage(
        `${data.year}年${data.month}月・${data.staff_count ?? 0}名を処理${
          errors ? `（うち ${errors} 件で API エラー）` : ""
        }`,
      );
    } catch {
      setMessage("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        給与明細・勤怠サマリー（有給残など）は freee 人事労務 API から取得し、
        <code className="mx-1 rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
          payslip_cache
        </code>
        および
        <code className="mx-1 rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
          deemed_ot_records
        </code>
        に保存されます。Vercel Cron（毎月25日 09:00 UTC 相当・
        <code className="text-xs">/api/cron/sync-freee</code>
        ）でも同じ処理が走ります。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/freee/auth"
          className="inline-flex rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          freee 人事労務と連携する
        </a>
        <button
          type="button"
          onClick={runSync}
          disabled={loading}
          className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {loading ? "同期中…" : "全員分を今すぐ同期（先月分会社デフォルト）"}
        </button>
      </div>
      {message ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
      ) : null}
      <p className="text-xs text-zinc-500">
        環境変数: <code>FREEE_CLIENT_ID</code>, <code>FREEE_CLIENT_SECRET</code>,{" "}
        <code>FREEE_REDIRECT_URI</code>, <code>FREEE_COMPANY_ID</code>
        。各ユーザーの freee 従業員IDは HR 設定・DB の{" "}
        <code className="text-xs">profiles.freee_employee_id</code> で紐付けます。
      </p>
    </div>
  );
}
