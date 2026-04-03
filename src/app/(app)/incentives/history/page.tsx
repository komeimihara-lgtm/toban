import { IncentiveHistoryView } from "@/components/incentive/incentive-history-view";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { checkAdminRole } from "@/lib/require-admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type RawRow = {
  id: string;
  year: number;
  month: number;
  incentive_amount: number;
  status: string;
  profiles: { full_name: string | null }[] | { full_name: string | null } | null;
};

type Row = {
  id: string;
  year: number;
  month: number;
  employee_name: string | null;
  incentive_amount: number;
  status: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function IncentivesHistoryPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkAdminRole(supabase, user.id))) {
    redirect("/my/incentive");
  }

  const { data: rows, error } = await supabase
    .from("incentive_configs")
    .select("id, year, month, incentive_amount, status, profiles!employee_id(full_name)")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(500);

  const list = ((rows ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    employee_name: Array.isArray(r.profiles)
      ? (r.profiles[0]?.full_name ?? null)
      : (r.profiles?.full_name ?? null),
    incentive_amount: r.incentive_amount,
    status: r.status,
  })) satisfies Row[];

  const byYm = new Map<
    string,
    { total: number; year: number; month: number; statuses: Map<string, number> }
  >();
  for (const r of list) {
    const key = `${r.year}-${pad(r.month)}`;
    const cur = byYm.get(key) ?? {
      total: 0,
      year: r.year,
      month: r.month,
      statuses: new Map<string, number>(),
    };
    cur.total += Number(r.incentive_amount ?? 0);
    cur.statuses.set(r.status, (cur.statuses.get(r.status) ?? 0) + 1);
    byYm.set(key, cur);
  }

  const monthly = [...byYm.entries()].map(([ym, v]) => {
    const statusLabel =
      v.statuses.size > 1
        ? "複数ステータス"
        : [...v.statuses.keys()][0] ?? "—";
    return {
      ym,
      year: v.year,
      month: v.month,
      total: v.total,
      statusLabel,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">インセンティブ・支給履歴</h1>
        <Link
          href="/incentives"
          className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          計算・提出へ
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : (
        <IncentiveHistoryView monthly={monthly} detailRows={list} />
      )}
    </div>
  );
}
