"use client";

import { submitLeaveRequestAction } from "@/app/actions/leave-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LeaveRequestForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      id="leave-req-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await submitLeaveRequestAction(fd);
          if (r.ok) {
            setMessage("申請を送信しました。承認をお待ちください。");
            router.refresh();
            (e.currentTarget as HTMLFormElement).reset();
          } else {
            setMessage(r.error);
          }
        });
      }}
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        休暇の新規申請
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-500">
          開始日
          <input
            name="start_date"
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <label className="text-xs text-zinc-500">
          終了日
          <input
            name="end_date"
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
      </div>
      <label className="text-xs text-zinc-500">
        種別
        <select
          name="kind"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          <option value="full">全日</option>
          <option value="half">半日</option>
          <option value="hour">時間単位（概算0.25日/日として集計）</option>
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        理由（任意）
        <input
          name="reason"
          type="text"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="例：私用のため"
        />
      </label>
      {message && (
        <p
          className={`text-sm ${message.includes("送信") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          role="status"
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "送信中…" : "申請する"}
      </button>
    </form>
  );
}
