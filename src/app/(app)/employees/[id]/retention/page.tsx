import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { checkAdminRole } from "@/lib/require-admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeeRetentionDetailPage({
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

  if (!(await checkAdminRole(supabase, user.id))) {
    redirect("/my");
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!target) notFound();

  const sinceIso = new Date();
  sinceIso.setDate(sinceIso.getDate() - 90);

  const [{ data: punches }, { data: expenses }, { data: deals }] = await Promise.all([
    supabase
      .from("attendance_punches")
      .select("punch_type, punched_at")
      .eq("user_id", id)
      .gte("punched_at", sinceIso.toISOString())
      .order("punched_at", { ascending: false })
      .limit(400),
    supabase
      .from("expenses")
      .select("id, category, amount, status, paid_date, purpose, created_at")
      .eq("submitter_id", id)
      .neq("status", "draft")
      .gte("created_at", sinceIso.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("deals")
      .select(
        "id, salon_name, year, month, appo_incentive, closer_incentive, submit_status, payment_date",
      )
      .or(`appo_employee_id.eq.${id},closer_employee_id.eq.${id}`)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const name = (target as { full_name?: string | null }).full_name?.trim() ?? "従業員";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href={`/employees/${id}`}
        className="text-sm text-emerald-700 underline dark:text-emerald-400"
      >
        ← {name} の従業員詳細
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          退職リスク・詳細サマリー
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          直近90日の打刻・経費、および関連案件のインセンティブです。
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">打刻（新しい順・最大400件）</h2>
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs font-mono text-zinc-700 dark:text-zinc-300">
          {(punches ?? []).length === 0 && (
            <li className="text-zinc-500">データがありません</li>
          )}
          {(punches ?? []).map((p) => {
            const row = p as { punch_type: string; punched_at: string };
            return (
              <li key={`${row.punched_at}-${row.punch_type}`}>
                {row.punch_type} · {row.punched_at}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">経費申請</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-2">日付/支払</th>
                <th className="py-1 pr-2">区分</th>
                <th className="py-1 pr-2">状態</th>
                <th className="py-1 text-right">金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(expenses ?? []).map((raw) => {
                const e = raw as {
                  id: string;
                  paid_date: string;
                  category: string;
                  status: string;
                  amount: number;
                };
                return (
                  <tr key={e.id}>
                    <td className="py-1 pr-2 tabular-nums">{e.paid_date}</td>
                    <td className="py-1 pr-2">{e.category}</td>
                    <td className="py-1 pr-2">{e.status}</td>
                    <td className="py-1 text-right tabular-nums">{e.amount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!expenses?.length && (
            <p className="py-2 text-sm text-zinc-500">該当がありません</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">案件・インセンティブ</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-2">年月</th>
                <th className="py-1 pr-2">サロン</th>
                <th className="py-1 pr-2">状態</th>
                <th className="py-1 text-right">インセン</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(deals ?? []).map((raw) => {
                const d = raw as {
                  id: string;
                  year: number;
                  month: number;
                  salon_name: string;
                  submit_status: string;
                  appo_incentive: number;
                  closer_incentive: number;
                };
                const inc = Math.round(
                  Number(d.appo_incentive || 0) + Number(d.closer_incentive || 0),
                );
                return (
                  <tr key={d.id}>
                    <td className="py-1 pr-2 tabular-nums">
                      {d.year}-{String(d.month).padStart(2, "0")}
                    </td>
                    <td className="py-1 pr-2">{d.salon_name || "—"}</td>
                    <td className="py-1 pr-2">{d.submit_status}</td>
                    <td className="py-1 text-right tabular-nums">{inc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!deals?.length && (
            <p className="py-2 text-sm text-zinc-500">該当がありません</p>
          )}
        </div>
      </section>
    </div>
  );
}
