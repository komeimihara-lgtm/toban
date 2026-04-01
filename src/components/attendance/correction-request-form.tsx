"use client";

import type { CorrectionFormState } from "@/app/actions/attendance-actions";
import { submitPunchCorrectionRequest } from "@/app/actions/attendance-actions";
import { useActionState } from "react";

const initial: CorrectionFormState = {
  ok: false,
  message: "",
};

export function CorrectionRequestForm() {
  const [state, formAction, pending] = useActionState(
    submitPunchCorrectionRequest,
    initial,
  );

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-5">
      {state.message && (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          }
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <div>
        <label
          htmlFor="target_date"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          対象日
        </label>
        <input
          id="target_date"
          name="target_date"
          type="date"
          required
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          修正する打刻
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input type="radio" name="punch_kind" value="clock_in" defaultChecked />
          出勤
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input type="radio" name="punch_kind" value="clock_out" />
          退勤
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input type="radio" name="punch_kind" value="both" />
          両方
        </label>
      </fieldset>

      <div>
        <label
          htmlFor="corrected_time"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          正しい打刻時刻（任意・例 09:00）
        </label>
        <input
          id="corrected_time"
          name="corrected_time"
          type="time"
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          理由（必須）
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={4}
          disabled={pending}
          placeholder="例: 電車遅延のため出勤打刻が遅れた"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "送信中…" : "申請する"}
      </button>
    </form>
  );
}
