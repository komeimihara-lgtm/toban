import type { PersonalHrData } from "@/lib/employee-hr-queries";
import Link from "next/link";

const EMP_LABEL: Record<string, string> = {
  full_time: "正社員",
  part_time: "パート・アルバイト",
  contract: "契約社員",
  dispatch: "派遣",
};

function yen(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function PersonalHrSummary({ data }: { data: PersonalHrData }) {
  const c = data.contract;
  const empKey = c?.employment_type != null ? String(c.employment_type) : "";
  const empLabel = EMP_LABEL[empKey] ?? (empKey || "—");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        あなたの雇用・有給サマリー
      </h2>
      {!c ? (
        <p className="mt-2 text-sm text-zinc-500">
          雇用契約が未登録です。人事担当にお問い合わせください。
        </p>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">雇用形態</dt>
            <dd className="font-medium">{empLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">入社日</dt>
            <dd className="font-medium tabular-nums">
              {String(c.start_date ?? c.hire_date ?? "—")}
              {data.yearsEmployed != null ? (
                <span className="ml-2 text-zinc-500">（勤続 {data.yearsEmployed} 年）</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">基本給</dt>
            <dd className="font-medium tabular-nums">{yen(c.base_salary as number)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">みなし残業</dt>
            <dd className="tabular-nums">
              {String(c.deemed_overtime_hours ?? "—")} 時間 /{" "}
              {yen(c.deemed_overtime_amount as number)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">有給残日数（概算）</dt>
            <dd className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              {data.paidLeaveRemaining} 日
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">次回有給付与日・付与予定（増分）</dt>
            <dd className="tabular-nums">
              {data.nextGrantDate ?? "—"}
              {data.nextGrantDelta != null ? (
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                  （+{data.nextGrantDelta} 日）
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">通勤費登録</dt>
            <dd>
              {data.commuteActiveCount > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  登録あり（{data.commuteActiveCount} 件）
                </span>
              ) : (
                <span className="text-amber-800 dark:text-amber-300">未登録</span>
              )}
            </dd>
          </div>
          {data.onProbation && c.trial_end_date ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">試用期間終了日</dt>
              <dd className="font-medium text-amber-900 dark:text-amber-200">
                {String(c.trial_end_date)}（試用期間中）
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        詳細は{" "}
        <Link href="/my/contract" className="text-emerald-700 underline dark:text-emerald-400">
          契約内容（マイページ）
        </Link>
        でもご覧いただけます。
      </p>
    </section>
  );
}
