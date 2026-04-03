"use client";

import { submitEmploymentContractAction } from "@/app/actions/employee-hr-actions";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EMP_OPTIONS = [
  ["full_time", "正社員"],
  ["part_time", "短時間勤務"],
  ["contract", "契約社員"],
  ["dispatch", "派遣"],
] as const;

export function EmploymentContractForm({
  employeeId,
  contract,
  canViewSalary,
}: {
  employeeId: string;
  contract: Record<string, unknown> | null;
  canViewSalary: boolean;
}) {
  const router = useRouter();
  const c = contract;
  const [toast, setToast] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    submitEmploymentContractAction,
    null as { ok: boolean; message?: string } | null,
  );

  useEffect(() => {
    if (state?.ok) {
      queueMicrotask(() => {
        setToast("保存しました");
        router.refresh();
      });
      const t = window.setTimeout(() => setToast(null), 3500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [state, router]);

  return (
    <>
      <form action={formAction} className="mt-4 space-y-3 text-sm">
        <input type="hidden" name="employee_id" value={employeeId} />
        <label className="block">
          <span className="text-xs text-zinc-500">雇用形態</span>
          <select
            name="employment_type"
            defaultValue={String(c?.employment_type ?? "full_time")}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
          >
            {EMP_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">入社日</span>
          <input
            type="date"
            name="start_date"
            required
            defaultValue={String(c?.start_date ?? c?.hire_date ?? "")}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">試用期間終了日</span>
          <input
            type="date"
            name="trial_end_date"
            defaultValue={String(c?.trial_end_date ?? "")}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {canViewSalary && (
            <>
              <label className="block">
                <span className="text-xs text-zinc-500">基本給（月）</span>
                <input
                  type="number"
                  name="base_salary"
                  defaultValue={c?.base_salary != null ? String(c.base_salary) : ""}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">時給</span>
                <input
                  type="number"
                  name="hourly_wage"
                  defaultValue={c?.hourly_wage != null ? String(c.hourly_wage) : ""}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">所定労働時間 / 日</span>
                <input
                  type="number"
                  step="0.1"
                  name="work_hours_per_day"
                  defaultValue={
                    c?.work_hours_per_day != null ? String(c.work_hours_per_day) : ""
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">所定労働日数 / 週</span>
                <input
                  type="number"
                  step="0.1"
                  name="work_days_per_week"
                  defaultValue={
                    c?.work_days_per_week != null ? String(c.work_days_per_week) : ""
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">みなし残業（時間）</span>
                <input
                  type="number"
                  step="0.1"
                  name="deemed_overtime_hours"
                  defaultValue={
                    c?.deemed_overtime_hours != null
                      ? String(c.deemed_overtime_hours)
                      : ""
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">みなし残業代</span>
                <input
                  type="number"
                  name="deemed_overtime_amount"
                  defaultValue={
                    c?.deemed_overtime_amount != null
                      ? String(c.deemed_overtime_amount)
                      : ""
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                />
              </label>
            </>
          )}
          <label className="block">
            <span className="text-xs text-zinc-500">通勤手当（月額）</span>
            <input
              type="number"
              name="commute_allowance_monthly"
              defaultValue={
                c?.commute_allowance_monthly != null
                  ? String(c.commute_allowance_monthly)
                  : ""
              }
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-zinc-500">通勤経路（概要）</span>
            <input
              name="commute_route"
              defaultValue={String(c?.commute_route ?? "")}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">通勤距離 km</span>
            <input
              type="number"
              step="0.1"
              name="commute_distance_km"
              defaultValue={
                c?.commute_distance_km != null ? String(c.commute_distance_km) : ""
              }
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-zinc-500">備考</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={String(c?.notes ?? "")}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="hidden" name="is_active" value="off" />
          <input
            type="checkbox"
            name="is_active"
            value="on"
            defaultChecked={c?.is_active !== false}
          />
          <span>契約を有効にする</span>
        </label>
        {state && !state.ok && state.message ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "保存中…" : "契約を保存"}
        </button>
      </form>
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      ) : null}
    </>
  );
}
