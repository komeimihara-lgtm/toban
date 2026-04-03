import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { nextMilestoneGrantDelta, ymdJst } from "@/lib/paid-leave";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function yen(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export default async function MyContractPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empRow } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const employeePk = (empRow as { id: string } | null)?.id ?? null;

  const { data: c } = employeePk
    ? await supabase
        .from("employment_contracts")
        .select("*")
        .eq("employee_id", employeePk)
        .maybeSingle()
    : { data: null };

  const { data: commutes } = employeePk
    ? await supabase
        .from("commute_expenses")
        .select(
          "route_name, from_station, to_station, transportation, monthly_amount, ticket_type, is_active",
        )
        .eq("employee_id", employeePk)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: plb } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, next_accrual_date, next_accrual_days")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) {
    return (
      <div
        className="mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
        role="alert"
      >
        <p className="text-lg font-semibold">契約情報が見つかりません</p>
        <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  const row = c as Record<string, unknown>;
  const startYmd = String(row.start_date ?? row.hire_date ?? "");
  let nextGrantYmd: string | null = null;
  let nextGrantDelta: number | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
    const hire = new Date(`${startYmd}T12:00:00+09:00`);
    const milestone = nextMilestoneGrantDelta(hire);
    if (milestone) {
      nextGrantYmd = ymdJst(milestone.date);
      nextGrantDelta = milestone.delta;
    }
  }

  const cacheNext =
    row.next_paid_leave_date != null ? String(row.next_paid_leave_date) : null;
  const cacheDays =
    row.next_paid_leave_days != null ? Number(row.next_paid_leave_days) : null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          雇用契約内容（閲覧のみ）
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          表示されている情報の変更は人事担当までお問い合わせください。
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">基本条件</h2>
        <dl className="mt-4 grid gap-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">基本給</dt>
            <dd className="font-medium tabular-nums">{yen(row.base_salary as number)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">みなし残業（時間・金額）</dt>
            <dd className="tabular-nums">
              {row.deemed_overtime_hours != null ? `${row.deemed_overtime_hours} 時間` : "—"} /{" "}
              {yen(row.deemed_overtime_amount as number)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">入社日</dt>
            <dd className="tabular-nums">
              {String(row.start_date ?? row.hire_date ?? "—")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">試用期間（満了日）</dt>
            <dd className="tabular-nums">{String(row.trial_end_date ?? "—")}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">通勤費（登録中）</h2>
        {(commutes ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">有効な通勤費登録がありません。</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {(commutes ?? []).map((raw) => {
              const m = raw as {
                route_name: string | null;
                from_station: string | null;
                to_station: string | null;
                transportation: string;
                monthly_amount: number;
                ticket_type: string;
              };
              return (
                <li
                  key={`${m.from_station}-${m.to_station}-${m.monthly_amount}`}
                  className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <p className="font-medium">
                    {m.route_name?.trim() ||
                      [m.from_station, m.to_station].filter(Boolean).join(" → ") ||
                      "経路"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {m.transportation} · {m.ticket_type} · 月額 {yen(m.monthly_amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          有給（参考・次回付与）
        </h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">残日数（キャッシュ）</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {(plb as { days_remaining?: number } | null)?.days_remaining ?? "—"}{" "}
              <span className="text-base font-normal text-zinc-500">日</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">次回付与日・付与予定日数（システム計算）</dt>
            <dd className="tabular-nums">
              {nextGrantYmd ?? "—"}
              {nextGrantDelta != null ? `（+${nextGrantDelta} 日）` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">契約マスタ上の次回有給（列がある場合）</dt>
            <dd className="tabular-nums">
              {cacheNext ?? "—"}
              {cacheDays != null ? `（${cacheDays} 日）` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">paid_leave_balances の次回付与</dt>
            <dd className="tabular-nums">
              {(plb as { next_accrual_date?: string } | null)?.next_accrual_date ?? "—"}
              {(plb as { next_accrual_days?: number } | null)?.next_accrual_days != null
                ? `（${(plb as { next_accrual_days: number }).next_accrual_days} 日）`
                : ""}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-zinc-500">
        人事情報の詳細は{" "}
        <Link href={`/employees/${user.id}`} className="text-emerald-700 underline dark:text-emerald-400">
          従業員ページ
        </Link>
        でも確認できます（権限により表示が異なります）。
      </p>
    </div>
  );
}
