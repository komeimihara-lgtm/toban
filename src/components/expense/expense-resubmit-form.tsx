"use client";

import { resubmitRejectedExpenseAction } from "@/app/actions/expense-resubmit-actions";
import { useActionState } from "react";

type Row = {
  id: string;
  type: string;
  category: string;
  amount: number;
  paid_date: string;
  purpose: string;
  vendor: string | null;
  rejection_reason: string | null;
};

export function ExpenseResubmitForm({ row }: { row: Row }) {
  const [state, action, pending] = useActionState(resubmitRejectedExpenseAction, null as null | {
    ok: boolean;
    message?: string;
  });

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">差戻し理由</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-50">
        {row.rejection_reason?.trim() || "（理由なし）"}
      </p>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={row.id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            種別
            <select
              name="type"
              defaultValue={row.type}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            >
              <option value="expense">経費</option>
              <option value="travel">出張</option>
              <option value="advance">仮払</option>
              <option value="advance_settle">仮払精算</option>
            </select>
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            カテゴリ
            <input
              name="category"
              required
              defaultValue={row.category}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            金額
            <input
              name="amount"
              type="number"
              step="1"
              required
              defaultValue={row.amount}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            支払日
            <input
              name="paid_date"
              type="date"
              required
              defaultValue={row.paid_date}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            />
          </label>
        </div>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          支払先・取引先
          <input
            name="vendor"
            defaultValue={row.vendor ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          用途・内容
          <textarea
            name="purpose"
            required
            rows={3}
            defaultValue={row.purpose}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? "送信中…" : "修正して再申請（第1承認待ちへ）"}
        </button>
        {state && !state.ok && state.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
        ) : null}
        {state && state.ok ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">再提出しました。</p>
        ) : null}
      </form>
    </div>
  );
}
