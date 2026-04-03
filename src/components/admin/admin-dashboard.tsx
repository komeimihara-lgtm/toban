import { recommendAiInterviewFromRetentionAction } from "@/app/actions/ai-interview-actions";
import { resolveRetentionAlertAction } from "@/app/actions/retention-actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";

export const dynamic = "force-dynamic";

function jstTodayBounds() {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  return {
    start: `${ymd}T00:00:00+09:00`,
    end: `${ymd}T23:59:59.999+09:00`,
  };
}

function todayPunchStatus(
  rows: { punch_type: string; punched_at: string }[],
): { label: string; detail: string } {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
  );
  let lastIn: string | null = null;
  let lastOut: string | null = null;
  for (const r of sorted) {
    if (r.punch_type === "clock_in") lastIn = r.punched_at;
    if (r.punch_type === "clock_out") lastOut = r.punched_at;
  }
  if (!lastIn) {
    return { label: "未出勤", detail: "—" };
  }
  const inTime = new Date(lastIn).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!lastOut || new Date(lastOut) < new Date(lastIn)) {
    return {
      label: "勤務中",
      detail: `出勤 ${inTime} · 未退勤`,
    };
  }
  const outTime = new Date(lastOut).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    label: "退勤済",
    detail: `出勤 ${inTime} · 退勤 ${outTime}`,
  };
}

const roleLabel: Record<string, string> = {
  owner: "オーナー",
  approver: "承認者",
  staff: "スタッフ",
};

/** owner / approver 向けダッシュボード（呼び出し側で権限チェック） */
export async function AdminDashboard() {
  if (!isSupabaseConfigured()) {
    return <p>Supabase 未設定</p>;
  }
  const supabase = await createClient();

  const nowD = new Date();
  const yDash = nowD.getFullYear();
  const moDash = nowD.getMonth();
  const monthStartIso = new Date(yDash, moDash, 1).toISOString();
  const monthEndIso = new Date(yDash, moDash + 1, 1).toISOString();

  const { data: monthApprovedRows } = await supabase
    .from("expenses")
    .select("amount, auto_approved, step2_approved_at")
    .eq("status", "approved")
    .gte("step2_approved_at", monthStartIso)
    .lt("step2_approved_at", monthEndIso);

  let autoCount = 0;
  let autoSum = 0;
  let manualCount = 0;
  let manualSum = 0;
  for (const raw of monthApprovedRows ?? []) {
    const r = raw as { amount: number; auto_approved?: boolean | null };
    const amt = Number(r.amount);
    if (r.auto_approved) {
      autoCount += 1;
      autoSum += amt;
    } else {
      manualCount += 1;
      manualSum += amt;
    }
  }
  const approvedTotalCount = autoCount + manualCount;
  const autoApprovalRatePct =
    approvedTotalCount > 0 ? (autoCount / approvedTotalCount) * 100 : 0;

  const { count: pendingStep1 } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("status", "step1_pending");
  const { count: pendingStep2 } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("status", "step2_pending");
  const pendingApproval = (pendingStep1 ?? 0) + (pendingStep2 ?? 0);

  const { data: expApprovedMonth } = await supabase
    .from("expenses")
    .select("amount")
    .eq("status", "approved")
    .gte("paid_date", monthStartIso.slice(0, 10))
    .lt("paid_date", monthEndIso.slice(0, 10));

  const expenseTotal =
    expApprovedMonth?.reduce(
      (a, e) => {
        const v = Number((e as { amount?: unknown }).amount);
        return a + (Number.isFinite(v) ? v : 0);
      },
      0,
    ) ?? 0;

  const { data: expenseByCategoryRows } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("status", "approved")
    .gte("paid_date", monthStartIso.slice(0, 10))
    .lt("paid_date", monthEndIso.slice(0, 10));

  const categoryTotals: { category: string; amount: number }[] = [];
  const catMap = new Map<string, number>();
  for (const raw of expenseByCategoryRows ?? []) {
    const r = raw as { category: string; amount: number };
    const c = String(r.category || "（未分類）");
    catMap.set(c, (catMap.get(c) ?? 0) + Number(r.amount || 0));
  }
  for (const [category, amount] of [...catMap.entries()].sort((a, b) => b[1] - a[1])) {
    categoryTotals.push({ category, amount });
  }
  const categoryMax = Math.max(...categoryTotals.map((x) => x.amount), 1);

  const prevMonthStart = new Date(yDash, moDash - 1, 1).toISOString();
  const prevMonthEnd = new Date(yDash, moDash, 0).toISOString();
  const { data: expApprovedPrev } = await supabase
    .from("expenses")
    .select("amount")
    .eq("status", "approved")
    .gte("paid_date", prevMonthStart.slice(0, 10))
    .lte("paid_date", prevMonthEnd.slice(0, 10));
  const expensePrevTotal =
    expApprovedPrev?.reduce(
      (a, e) => {
        const v = Number((e as { amount?: unknown }).amount);
        return a + (Number.isFinite(v) ? v : 0);
      },
      0,
    ) ?? 0;
  const expenseMoM_pct =
    expensePrevTotal > 0 ? ((expenseTotal - expensePrevTotal) / expensePrevTotal) * 100 : null;

  const dealYmY = yDash;
  const dealYmM = moDash + 1;
  const { data: dealRowsEst } = await supabase
    .from("deals")
    .select("appo_incentive, closer_incentive, submit_status")
    .eq("year", dealYmY)
    .eq("month", dealYmM)
    .in("submit_status", ["submitted", "approved"]);

  let incEst = 0;
  for (const raw of dealRowsEst ?? []) {
    const r = raw as { appo_incentive: number; closer_incentive: number };
    incEst += Math.floor(Number(r.appo_incentive) || 0) + Math.floor(Number(r.closer_incentive) || 0);
  }

  const { count: incentiveDraftCount } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("year", dealYmY)
    .eq("month", dealYmM)
    .eq("submit_status", "draft");

  const { count: dealsSubmittedPending } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("year", dealYmY)
    .eq("month", dealYmM)
    .eq("submit_status", "submitted");

  const { count: leavePendingCount } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "step1_pending");

  const { data: receiptRows } = await supabase
    .from("expenses")
    .select("id, receipt_url")
    .in("status", ["step1_pending", "step2_pending", "approved"])
    .limit(2000);
  const receiptMissing =
    (receiptRows ?? []).filter(
      (r) => !String((r as { receipt_url: string | null }).receipt_url ?? "").trim(),
    ).length;

  const { data: team } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });

  const { start: dayStart, end: dayEnd } = jstTodayBounds();
  const memberIds = (team ?? []).map((m) => (m as { id: string }).id);
  const { data: punchesToday } =
    memberIds.length > 0
      ? await supabase
          .from("attendance_punches")
          .select("user_id, punch_type, punched_at")
          .in("user_id", memberIds)
          .gte("punched_at", dayStart)
          .lte("punched_at", dayEnd)
      : { data: [] as { user_id: string; punch_type: string; punched_at: string }[] };

  const punchesByUser = new Map<string, { punch_type: string; punched_at: string }[]>();
  for (const row of punchesToday ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const punch = row as { punch_type: string; punched_at: string };
    const list = punchesByUser.get(uid) ?? [];
    list.push(punch);
    punchesByUser.set(uid, list);
  }

  const { data: recentExpenses } = await supabase
    .from("expenses")
    .select(
      "id, category, amount, status, submitter_name, created_at, updated_at",
    )
    .not("status", "eq", "draft")
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: retentionRows } = await supabase
    .from("retention_alerts")
    .select("id, employee_id, company_id, severity, message, detected_at, alert_type")
    .eq("is_resolved", false)
    .order("detected_at", { ascending: false })
    .limit(100);

  const nameById = new Map<string, string>();
  for (const m of team ?? []) {
    const r = m as { id: string; full_name: string | null };
    nameById.set(r.id, r.full_name?.trim() || "（無名）");
  }

  const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const retentionAlerts = [...(retentionRows ?? [])].sort(
    (a, b) =>
      (sevOrder[String((a as { severity: string }).severity)] ?? 9) -
      (sevOrder[String((b as { severity: string }).severity)] ?? 9),
  );

  const staffAttendance = (team ?? [])
    .map((m) => {
      const row = m as { id: string; full_name: string | null; role: string };
      const st = todayPunchStatus(punchesByUser.get(row.id) ?? []);
      return {
        id: row.id,
        name: row.full_name?.trim() || "（無名）",
        roleKey: row.role,
        ...st,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        ダッシュボード
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        経費精算・承認・インセンティブの月次サマリーです。
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            今月の経費合計（承認済・支払月）
          </p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {fmt(expenseTotal)}
          </p>
          {expenseMoM_pct != null ? (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              先月比 {expenseMoM_pct >= 0 ? "▲" : "▼"} {Math.abs(expenseMoM_pct).toFixed(1)}%
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">先月比 —</p>
          )}
        </div>
        <Kpi
          title="承認待ち件数（経費）"
          value={`${pendingApproval} 件`}
        />
        <Kpi title="インセンティブ試算（案件・提出・承認分・今月）" value={fmt(incEst)} />
        <Kpi
          title="精算率（自動承認・今月・最終承認済のうち）"
          value={approvedTotalCount > 0 ? `${autoApprovalRatePct.toFixed(1)}%` : "—"}
        />
      </div>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">今月の経費（カテゴリ別）</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          承認済・支払日が当月の合計
        </p>
        <div className="mt-4 space-y-3">
          {categoryTotals.length === 0 ? (
            <p className="text-sm text-zinc-500">データがありません</p>
          ) : (
            categoryTotals.map(({ category, amount }) => (
              <div key={category}>
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{category}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                    {fmt(amount)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full min-w-0 rounded-full bg-accent/75"
                    style={{
                      width: `${Math.min(100, Math.round((amount / categoryMax) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">要対応</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li className="flex flex-wrap items-center gap-2">
            <span>
              承認待ち経費: {pendingStep1 ?? 0} 件（第1） / {pendingStep2 ?? 0}{" "}
              件（最終）
            </span>
            <Link href="/approval" className="text-blue-600 underline dark:text-blue-400">
              承認へ
            </Link>
          </li>
          <li>
            未提出インセンティブ（ドラフト）: {incentiveDraftCount ?? 0} 件 →{" "}
            <Link href="/incentives" className="text-blue-600 underline dark:text-blue-400">
              インセンティブ管理
            </Link>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>
              インセンティブ承認待ち（案件・今月）: {dealsSubmittedPending ?? 0} 件
            </span>
            <Link href="/incentives" className="text-blue-600 underline dark:text-blue-400">
              今すぐ確認
            </Link>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>有給申請承認待ち: {leavePendingCount ?? 0} 件</span>
            <Link href="/approval?tab=leave" className="text-blue-600 underline dark:text-blue-400">
              承認へ
            </Link>
          </li>
          <li>
            領収書未添付（承認待ち・承認済）: {receiptMissing} 件 →{" "}
            <Link href="/expenses/audit" className="text-blue-600 underline dark:text-blue-400">
              経費審査
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
          退職リスクアラート（離職防止）
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          日次バッチで検知。高リスクはオーナーに LINE 通知されます。
        </p>
        <ul className="mt-4 space-y-3">
          {retentionAlerts.length === 0 && (
            <li className="text-sm text-zinc-500">未対応のアラートはありません</li>
          )}
          {retentionAlerts.map((raw) => {
            const r = raw as {
              id: string;
              employee_id: string;
              company_id: string;
              severity: string;
              message: string;
              detected_at: string;
              alert_type: string;
            };
            const sev = r.severity as "high" | "medium" | "low";
            const badge =
              sev === "high"
                ? "border-red-600 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100"
                : sev === "medium"
                  ? "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-100"
                  : "border-blue-500 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100";
            const sevLabel =
              sev === "high" ? "高（即対応）" : sev === "medium" ? "中（要注意）" : "低（観察）";
            const empName = nameById.get(r.employee_id) ?? "—";
            return (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge}`}
                  >
                    {sevLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {empName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{r.message}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      検知:{" "}
                      {new Date(r.detected_at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/employees/${r.employee_id}/retention`}
                    className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    詳細を見る
                  </Link>
                  <form action={resolveRetentionAlertAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="employee_id" value={r.employee_id} />
                    <button
                      type="submit"
                      className="inline-flex rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      対応済み
                    </button>
                  </form>
                  <form action={recommendAiInterviewFromRetentionAction}>
                    <input type="hidden" name="employee_id" value={r.employee_id} />
                    <input type="hidden" name="alert_id" value={r.id} />
                    <input type="hidden" name="company_id" value={r.company_id} />
                    <button
                      type="submit"
                      className="inline-flex rounded-lg border border-violet-600 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
                    >
                      AI面談を推奨する
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">全スタッフの出勤状況（本日）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Asia/Tokyo · {staffAttendance.length} 名 · 出勤打刻から状態を表示しています
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2">氏名</th>
                <th className="px-3 py-2">権限</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">打刻</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {staffAttendance.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    メンバーがいません
                  </td>
                </tr>
              )}
              {staffAttendance.map((a) => (
                <tr key={a.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {roleLabel[a.roleKey] ?? a.roleKey}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        a.label === "未出勤"
                          ? "text-zinc-500"
                          : a.label === "勤務中"
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-zinc-700 dark:text-zinc-300"
                      }
                    >
                      {a.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {a.detail}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/employees/${a.id}`}
                      className="text-xs text-blue-600 underline dark:text-blue-400"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">最近の申請（5件）</h2>
        <p className="mt-1 text-xs text-zinc-500">経費（下書き除く・更新日の新しい順）</p>
        <ul className="mt-3 space-y-2 text-sm">
          {(recentExpenses ?? []).length === 0 && (
            <li className="text-zinc-500">該当がありません</li>
          )}
          {(recentExpenses ?? []).map((raw) => {
            const r = raw as {
              id: string;
              category: string;
              amount: number;
              status: string;
              submitter_name: string | null;
              updated_at: string;
            };
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <div>
                  <span className="font-medium">{r.category}</span>
                  <span className="ml-2 text-xs text-zinc-500">{r.submitter_name ?? "—"}</span>
                  <span className="ml-2 text-xs tabular-nums text-zinc-500">{r.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{fmt(r.amount)}</span>
                  <Link
                    href={`/expenses/audit`}
                    className="text-xs text-blue-600 underline dark:text-blue-400"
                  >
                    審査
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          自動承認の統計（今月・最終承認日ベース）
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">自動承認・件数</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{autoCount} 件</p>
            <p className="text-xs text-zinc-600">{fmt(autoSum)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">手動承認・件数</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{manualCount} 件</p>
            <p className="text-xs text-zinc-600">{fmt(manualSum)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">自動承認率（承認済のうち）</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {approvedTotalCount > 0 ? `${autoApprovalRatePct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="flex items-end">
            <Link
              href="/settings/auto-approval"
              className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              自動承認ルール
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
