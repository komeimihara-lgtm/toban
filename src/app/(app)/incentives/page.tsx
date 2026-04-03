import { DealsAdminClient } from "@/components/incentive/deals-admin-client";
import { IncentiveHistoryView } from "@/components/incentive/incentive-history-view";
import { IncentiveTabSwitcher } from "@/components/incentive/incentive-tab-switcher";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import { resolveUserRole } from "@/lib/require-admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type RawRow = {
  id: string;
  year: number;
  month: number;
  incentive_amount: number;
  status: string;
  employees: { name: string | null }[] | { name: string | null } | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function IncentivesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "deals";

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Supabase の環境変数を設定してください。
      </p>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await resolveUserRole(supabase, user.id);
  if (!isAdminRole(role)) {
    redirect("/my/incentive");
  }

  let monthly: { ym: string; year: number; month: number; total: number; statusLabel: string }[] = [];
  let detailRows: { id: string; year: number; month: number; employee_name: string | null; incentive_amount: number; status: string }[] = [];
  let historyError: string | null = null;

  if (tab === "history") {
    const { data: rows, error } = await supabase
      .from("incentive_configs")
      .select("id, year, month, incentive_amount, status, employees!employee_id(name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(500);

    if (error) {
      historyError = error.message;
    } else {
      detailRows = ((rows ?? []) as RawRow[]).map((r) => ({
        id: r.id,
        year: r.year,
        month: r.month,
        employee_name: Array.isArray(r.employees)
          ? (r.employees[0]?.name ?? null)
          : (r.employees?.name ?? null),
        incentive_amount: r.incentive_amount,
        status: r.status,
      }));

      const byYm = new Map<string, { total: number; year: number; month: number; statuses: Map<string, number> }>();
      for (const r of detailRows) {
        const key = `${r.year}-${pad(r.month)}`;
        const cur = byYm.get(key) ?? { total: 0, year: r.year, month: r.month, statuses: new Map() };
        cur.total += Number(r.incentive_amount ?? 0);
        cur.statuses.set(r.status, (cur.statuses.get(r.status) ?? 0) + 1);
        byYm.set(key, cur);
      }
      monthly = [...byYm.entries()].map(([ym, v]) => ({
        ym,
        year: v.year,
        month: v.month,
        total: v.total,
        statusLabel: v.statuses.size > 1 ? "複数ステータス" : [...v.statuses.keys()][0] ?? "—",
      }));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          インセンティブ管理
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          案件の承認・差戻し、支給履歴の確認ができます。
        </p>
      </header>

      <IncentiveTabSwitcher activeTab={tab} />

      {tab === "deals" ? (
        <DealsAdminClient />
      ) : historyError ? (
        <p className="text-sm text-red-600">{historyError}</p>
      ) : (
        <IncentiveHistoryView monthly={monthly} detailRows={detailRows} />
      )}
    </div>
  );
}
