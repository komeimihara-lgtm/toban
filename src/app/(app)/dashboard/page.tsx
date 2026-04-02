import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return <p>Supabase 未設定</p>;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (me as { role?: string })?.role ?? "staff";
  if (!isAdminRole(role)) redirect("/my");

  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: expRows } = await supabase
    .from("expense_claims")
    .select("amount, status")
    .gte("created_at", startMonth);

  const expenseTotal =
    expRows
      ?.filter((e) => (e as { status: string }).status === "approved")
      .reduce((a, e) => a + Number((e as { amount: number }).amount), 0) ?? 0;

  const pendingApproval =
    expRows?.filter(
      (e) => (e as { status: string }).status === "step1_pending",
    ).length ?? 0;

  const y = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const { data: subs } = await supabase
    .from("incentive_submissions")
    .select("sales_amount, rate_snapshot, status")
    .eq("year_month", y);

  let incEst = 0;
  (subs ?? []).forEach((s) => {
    const st = (s as { status: string }).status;
    if (st === "submitted" || st === "approved") {
      const b = Number((s as { sales_amount: number }).sales_amount);
      const r = Number((s as { rate_snapshot: number }).rate_snapshot);
      if (Number.isFinite(b) && Number.isFinite(r)) incEst += Math.floor(b * r);
    }
  });

  const autoRules = await supabase
    .from("auto_approval_rules")
    .select("id")
    .eq("is_active", true);

  const autoRate = autoRules.data?.length
    ? Math.min(100, (pendingApproval / Math.max(expRows?.length ?? 1, 1)) * 100)
    : 0;

  const { data: alerts } = await supabase
    .from("retention_alerts")
    .select("id, employee_id, severity, message, detected_at, is_resolved")
    .eq("is_resolved", false)
    .order("detected_at", { ascending: false })
    .limit(20);

  const { data: empProfiles } = await supabase.from("profiles").select("id, full_name");

  const nameById = new Map(
    (empProfiles as { id: string; full_name: string | null }[] | null)?.map((e) => [
      e.id,
      e.full_name ?? "（無名）",
    ]) ?? [],
  );

  const { data: recentExp } = await supabase
    .from("expense_claims")
    .select("id, amount, category, status, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: todayAtt } = await supabase
    .from("attendance_punches")
    .select("user_id, punch_type, punched_at")
    .gte("punched_at", new Date(new Date().toDateString()).toISOString());

  const uniqueAtt = new Set((todayAtt ?? []).map((r) => (r as { user_id: string }).user_id));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">管理ダッシュボード</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="今月経費（承認済）" value={fmt(expenseTotal)} />
        <Kpi title="承認待ち件数" value={`${pendingApproval} 件`} />
        <Kpi title="インセンティブ試算（今月）" value={fmt(incEst)} />
        <Kpi title="自動承認率（参考）" value={`${autoRate.toFixed(0)}%`} />
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">要対応</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
          <li>承認待ち経費: {pendingApproval} 件 → <Link href="/approval" className="text-blue-600 underline">承認へ</Link></li>
          <li>未提出インセンティブ: CRMで確認</li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">本日の出勤（ユニーク打刻者）</h2>
        <p className="mt-2 text-2xl font-semibold">{uniqueAtt.size} 名</p>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40">
        <h2 className="font-medium text-amber-900 dark:text-amber-200">退職リスクアラート</h2>
        <ul className="mt-3 space-y-3">
          {(alerts ?? []).length === 0 && (
            <li className="text-sm text-zinc-600">未処理のアラートはありません</li>
          )}
          {(alerts ?? []).map((a) => {
            const sev = (a as { severity: string }).severity;
            const badge =
              sev === "high"
                ? "bg-red-600 text-white"
                : sev === "medium"
                  ? "bg-amber-500 text-white"
                  : "bg-blue-600 text-white";
            return (
              <li
                key={(a as { id: string }).id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div>
                  <span className={`rounded px-2 py-0.5 text-xs ${badge}`}>{sev}</span>
                  <span className="ml-2 font-medium">
                    {nameById.get((a as { employee_id: string }).employee_id) ?? "—"}
                  </span>
                  <p className="text-zinc-600">{(a as { message: string }).message}</p>
                </div>
                <Link
                  href={`/employees/${(a as { employee_id: string }).employee_id}`}
                  className="text-blue-600 underline"
                >
                  従業員詳細
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">最近の経費申請</h2>
        <ul className="mt-2 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {(recentExp ?? []).map((e) => (
            <li key={(e as { id: string }).id} className="flex justify-between py-2">
              <span>{(e as { category: string }).category}</span>
              <span>{fmt(Number((e as { amount: number }).amount))}</span>
              <span className="text-zinc-500">{(e as { status: string }).status}</span>
            </li>
          ))}
        </ul>
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
