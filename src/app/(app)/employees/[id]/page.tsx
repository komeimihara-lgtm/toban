import {
  upsertCommuteExpenseAction,
  upsertEmploymentContractAction,
} from "@/app/actions/employee-hr-actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getNextGrantDate,
  nextMilestoneGrantDelta,
  ymdJst,
} from "@/lib/paid-leave";
import { retentionRiskScoreFromOpenAlerts } from "@/lib/retention-analyzer";
import { checkAdminRole, resolveUserRole } from "@/lib/require-admin";
import { isRetentionAllowed, isSalaryAllowed } from "@/types/incentive";
import { subMonths } from "date-fns";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const EMP_OPTIONS = [
  ["full_time", "正社員"],
  ["part_time", "短時間勤務"],
  ["contract", "契約社員"],
  ["dispatch", "派遣"],
] as const;

const TRANSPORT = [
  ["train", "電車"],
  ["bus", "バス"],
  ["car", "車"],
  ["bicycle", "自転車"],
  ["walk", "徒歩"],
] as const;

const TICKET = [
  ["monthly", "月額"],
  ["quarterly", "季節"],
  ["annual", "年間"],
] as const;

function yearsEmployed(startYmd: string, end = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return null;
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const ey = end.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const [ey_, em_, ed_] = ey.split("-").map(Number);
  let y = ey_ - sy;
  if (em_ < sm || (em_ === sm && ed_ < sd)) y -= 1;
  return Math.max(0, y);
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const myRole = await resolveUserRole(supabase, user.id);
  const isAdmin = await checkAdminRole(supabase, user.id);
  const canViewSalary = isSalaryAllowed(myRole);
  const canViewRetention = isRetentionAllowed(myRole);

  // 非管理者は自分の従業員レコードのみアクセス可
  if (!isAdmin) {
    const { data: myEmp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!myEmp || (myEmp as { id: string }).id !== id) {
      redirect("/my");
    }
  }

  const { data: profile } = await supabase
    .from("employees")
    .select("id, name, role, department_id, departments ( name )")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const { data: contractRaw } = await supabase
    .from("employment_contracts")
    .select("*")
    .eq("employee_id", id)
    .maybeSingle();

  const c = (contractRaw ?? null) as Record<string, unknown> | null;

  const { data: grants } = await supabase
    .from("paid_leave_grants")
    .select("*")
    .eq("employee_id", id)
    .order("grant_date", { ascending: false });

  const { data: commutes } = await supabase
    .from("commute_expenses")
    .select("*")
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  const { data: interviews } = await supabase
    .from("ai_interview_requests")
    .select("requested_at, status, risk_level, completed_at")
    .eq("employee_id", id)
    .order("requested_at", { ascending: false });

  const threeMoIso = subMonths(new Date(), 3).toISOString();
  const { data: retentionOpenRows } = await supabase
    .from("retention_alerts")
    .select("severity")
    .eq("employee_id", id)
    .eq("is_resolved", false);
  const { data: retentionHistory } = await supabase
    .from("retention_alerts")
    .select("id, severity, message, detected_at, is_resolved, alert_type")
    .eq("employee_id", id)
    .gte("detected_at", threeMoIso)
    .order("detected_at", { ascending: false })
    .limit(40);

  const riskScore = retentionRiskScoreFromOpenAlerts(
    (retentionOpenRows ?? []) as { severity: "high" | "medium" | "low" }[],
  );

  const startYmd = (c?.start_date as string) ?? (c?.hire_date as string) ?? "";
  const startDate =
    startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)
      ? new Date(`${startYmd}T12:00:00+09:00`)
      : null;
  const nextGrant = startDate ? getNextGrantDate(startDate) : null;
  const nextDelta = startDate ? nextMilestoneGrantDelta(startDate) : null;
  const yrs = startYmd ? yearsEmployed(startYmd) : null;

  const p = profile as unknown as {
    name?: string | null;
    department_id?: string | null;
    departments?: { name: string } | null;
    role?: string;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href={isAdmin ? "/employees" : "/my"}
        className="text-sm text-emerald-700 underline dark:text-emerald-400"
      >
        ← {isAdmin ? "一覧" : "マイページ"}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{p.name ?? "従業員"}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          部署: {p.departments?.name ?? "—"} · ロール: {p.role ?? "—"}
        </p>
      </header>

      {canViewRetention ? (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                退職リスクスコア（未対応アラートから概算）
              </h2>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {riskScore}
                <span className="text-base font-normal text-zinc-500"> / 100</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/employees/${id}/retention`}
                className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                勤怠・経費・インセンティブ詳細
              </Link>
              <button
                type="button"
                disabled
                title="準備中"
                className="inline-flex cursor-not-allowed rounded-lg border border-dashed border-zinc-400 px-3 py-2 text-xs text-zinc-500 opacity-70 dark:border-zinc-600"
              >
                1on1を設定する（将来）
              </button>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-medium text-zinc-500">過去3ヶ月のアラート履歴</h3>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
              {(retentionHistory ?? []).length === 0 && (
                <li className="text-zinc-500">履歴がありません</li>
              )}
              {(retentionHistory ?? []).map((row) => {
                const h = row as {
                  id: string;
                  severity: string;
                  message: string;
                  detected_at: string;
                  is_resolved: boolean;
                };
                return (
                  <li
                    key={h.id}
                    className="rounded border border-zinc-200 bg-white/60 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/50"
                  >
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      [{h.severity}] {h.is_resolved ? "対応済" : "未対応"}
                    </span>{" "}
                    <span className="text-zinc-600 dark:text-zinc-400">{h.message}</span>
                    <span className="mt-0.5 block text-zinc-400">
                      {new Date(h.detected_at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          勤続・有給スケジュール
        </h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">入社からの年数</dt>
            <dd className="tabular-nums">{yrs != null ? `${yrs} 年` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">次回有給付与日</dt>
            <dd className="tabular-nums">
              {nextGrant ? ymdJst(nextGrant) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">付与予定（増分日数）</dt>
            <dd className="tabular-nums">
              {nextDelta ? `${nextDelta.delta} 日` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">雇用契約</h2>
        {!isAdmin && !c ? (
          <p className="mt-2 text-sm text-zinc-500">契約情報は未登録です。</p>
        ) : null}
        {!isAdmin && c ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">入社日</dt>
              <dd>{String(c.start_date ?? c.hire_date ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">試用期間終了</dt>
              <dd>{String(c.trial_end_date ?? "—")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">通勤（契約欄）</dt>
              <dd>
                {String(c.commute_allowance_monthly ?? "—")} 円 —{" "}
                {String(c.commute_route ?? "—")}
              </dd>
            </div>
            <p className="sm:col-span-2 text-xs text-zinc-500">
              編集は人事担当のみ可能です。
            </p>
          </dl>
        ) : null}
        {isAdmin ? (
          <form action={upsertEmploymentContractAction} className="mt-4 space-y-3 text-sm">
            <input type="hidden" name="employee_id" value={id} />
            <label className="block">
              <span className="text-xs text-zinc-500">雇用形態</span>
              <select
                name="employment_type"
                defaultValue={String(c?.employment_type ?? "full_time")}
                disabled={!isAdmin}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                disabled={!isAdmin}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500">試用期間終了日</span>
              <input
                type="date"
                name="trial_end_date"
                defaultValue={String(c?.trial_end_date ?? "")}
                disabled={!isAdmin}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-500">時給</span>
                    <input
                      type="number"
                      name="hourly_wage"
                      defaultValue={c?.hourly_wage != null ? String(c.hourly_wage) : ""}
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-500">所定労働時間 / 日</span>
                    <input
                      type="number"
                      step="0.1"
                      name="work_hours_per_day"
                      defaultValue={
                        c?.work_hours_per_day != null
                          ? String(c.work_hours_per_day)
                          : ""
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-500">所定労働日数 / 週</span>
                    <input
                      type="number"
                      step="0.1"
                      name="work_days_per_week"
                      defaultValue={
                        c?.work_days_per_week != null
                          ? String(c.work_days_per_week)
                          : ""
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                  disabled={!isAdmin}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">通勤経路（概要）</span>
                <input
                  name="commute_route"
                  defaultValue={String(c?.commute_route ?? "")}
                  disabled={!isAdmin}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">通勤距離 km</span>
                <input
                  type="number"
                  step="0.1"
                  name="commute_distance_km"
                  defaultValue={
                    c?.commute_distance_km != null
                      ? String(c.commute_distance_km)
                      : ""
                  }
                  disabled={!isAdmin}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-zinc-500">備考</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={String(c?.notes ?? "")}
                disabled={!isAdmin}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="hidden" name="is_active" value="off" />
              <input
                type="checkbox"
                name="is_active"
                value="on"
                defaultChecked={c?.is_active !== false}
                disabled={!isAdmin}
              />
              <span>契約を有効にする</span>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              契約を保存
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">通勤費登録</h2>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {(commutes ?? []).length === 0 ? (
            <li className="py-2 text-zinc-500">登録なし</li>
          ) : (
            (commutes ?? []).map((row) => {
              const cm = row as Record<string, unknown>;
              return (
                <li key={String(cm.id)} className="py-3">
                  {isAdmin ? (
                    <form
                      action={upsertCommuteExpenseAction}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={String(cm.id)} />
                      <input type="hidden" name="employee_id" value={id} />
                      <input
                        name="route_name"
                        defaultValue={String(cm.route_name ?? "")}
                        placeholder="経路名"
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <input
                        name="from_station"
                        defaultValue={String(cm.from_station ?? "")}
                        placeholder="出発"
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <input
                        name="to_station"
                        defaultValue={String(cm.to_station ?? "")}
                        placeholder="到着"
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <select
                        name="transportation"
                        defaultValue={String(cm.transportation ?? "train")}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      >
                        {TRANSPORT.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        name="monthly_amount"
                        defaultValue={String(cm.monthly_amount ?? 0)}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <select
                        name="ticket_type"
                        defaultValue={String(cm.ticket_type ?? "monthly")}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      >
                        {TICKET.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        name="valid_from"
                        defaultValue={String(cm.valid_from ?? "")}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <input
                        type="date"
                        name="valid_to"
                        defaultValue={String(cm.valid_to ?? "")}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <label className="flex items-center gap-2 sm:col-span-2">
                        <input
                          type="hidden"
                          name="is_active"
                          value="off"
                        />
                        <input
                          type="checkbox"
                          name="is_active"
                          value="on"
                          defaultChecked={cm.is_active !== false}
                        />
                        有効
                      </label>
                      <button
                        type="submit"
                        className="rounded bg-zinc-800 px-3 py-1 text-white sm:col-span-2"
                      >
                        更新
                      </button>
                    </form>
                  ) : (
                    <p>
                      {String(cm.route_name ?? "経路")} ·{" "}
                      {String(cm.monthly_amount ?? 0)} 円 /{" "}
                      {String(cm.transportation ?? "")}
                    </p>
                  )}
                </li>
              );
            })
          )}
        </ul>
        {isAdmin ? (
          <form
            action={upsertCommuteExpenseAction}
            className="mt-4 space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-600"
          >
            <p className="text-xs font-medium text-zinc-500">通勤費を追加</p>
            <input type="hidden" name="employee_id" value={id} />
            <input type="hidden" name="is_active" value="off" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                name="route_name"
                placeholder="経路名"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <input
                name="from_station"
                placeholder="出発"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <input
                name="to_station"
                placeholder="到着"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <select
                name="transportation"
                defaultValue="train"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              >
                {TRANSPORT.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="monthly_amount"
                placeholder="月額"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <select
                name="ticket_type"
                defaultValue="monthly"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              >
                {TICKET.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="valid_from"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <input
                type="date"
                name="valid_to"
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" name="is_active" value="on" defaultChecked />
                有効で登録
              </label>
            </div>
            <button
              type="submit"
              className="rounded bg-emerald-700 px-3 py-1.5 text-white"
            >
              追加
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">有給付与履歴</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1">付与日</th>
                <th className="py-1">付与</th>
                <th className="py-1">使用</th>
                <th className="py-1">残</th>
                <th className="py-1">理由</th>
                <th className="py-1">失効</th>
              </tr>
            </thead>
            <tbody>
              {(grants ?? []).map((g) => {
                const x = g as Record<string, unknown>;
                return (
                  <tr key={String(x.id)} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1 tabular-nums">{String(x.grant_date)}</td>
                    <td className="py-1">{String(x.days_granted)}</td>
                    <td className="py-1">{String(x.days_used)}</td>
                    <td className="py-1">{String(x.days_remaining)}</td>
                    <td className="py-1">{String(x.grant_reason)}</td>
                    <td className="py-1 tabular-nums">{String(x.expires_at ?? "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!grants?.length && (
            <p className="py-2 text-sm text-zinc-500">履歴がありません</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">AI面談履歴</h2>
        <ul className="mt-2 text-sm">
          {(interviews ?? []).map((i) => (
            <li key={(i as { requested_at: string }).requested_at}>
              {(i as { status: string }).status} —{" "}
              {(i as { risk_level?: string }).risk_level ?? "—"} —{" "}
              {(i as { completed_at?: string }).completed_at ??
                (i as { requested_at: string }).requested_at}
            </li>
          ))}
          {!interviews?.length && <li className="text-zinc-500">なし</li>}
        </ul>
      </section>
    </div>
  );
}
