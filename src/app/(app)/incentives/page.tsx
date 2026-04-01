import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole, isIncentiveEligible, type ProfileRow } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function currentYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function IncentivesAdminPage() {
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

  if (!user) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        ログインが必要です。
      </p>
    );
  }

  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (selfProfile as { role?: string } | null)?.role ?? "staff";
  if (!isAdminRole(role)) {
    redirect("/my/incentive");
  }

  const ym = currentYearMonth();

  const { data: targets, error: targetsErr } = await supabase
    .from("profiles")
    .select("id, full_name, is_sales_target, is_service_target")
    .or("is_sales_target.eq.true,is_service_target.eq.true")
    .order("full_name", { ascending: true });

  if (targetsErr) {
    return (
      <p className="text-sm text-red-600">
        スタッフ一覧の取得に失敗しました。
      </p>
    );
  }

  const rows = (targets as ProfileRow[])?.filter(isIncentiveEligible) ?? [];

  const { data: subs } = await supabase
    .from("incentive_submissions")
    .select(
      "user_id, year_month, sales_amount, status, submitted_at, rate_snapshot",
    )
    .eq("year_month", ym);

  const subByUser = new Map(
    (subs as { user_id: string; sales_amount: number | null; status: string; submitted_at: string | null; rate_snapshot: number | null }[])?.map(
      (s) => [s.user_id, s],
    ) ?? [],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          インセンティブ（全社）
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          対象月 {ym} — 管理者・第1承認者向け一覧
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3">名前</th>
              <th className="px-4 py-3">区分</th>
              <th className="px-4 py-3">売上（円）</th>
              <th className="px-4 py-3">率</th>
              <th className="px-4 py-3">試算</th>
              <th className="px-4 py-3">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-zinc-500"
                >
                  対象者がいません。
                </td>
              </tr>
            ) : (
              rows.map((person) => {
                const s = subByUser.get(person.id);
                const sales = s?.sales_amount ?? null;
                const r = s?.rate_snapshot ?? null;
                const est =
                  sales != null && r != null ? Math.floor(sales * r) : null;
                const flags = [
                  person.is_sales_target ? "営業" : null,
                  person.is_service_target ? "サービス" : null,
                ]
                  .filter(Boolean)
                  .join("・");

                return (
                  <tr
                    key={person.id}
                    className="bg-white dark:bg-zinc-950/30"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {person.full_name ?? "（無名）"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {flags}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {sales != null ? formatYen(sales) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r != null
                        ? `${(r * 100).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {est != null ? formatYen(est) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s?.status === "submitted" && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                          承認待ち
                        </span>
                      )}
                      {s?.status === "approved" && (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                          承認済
                        </span>
                      )}
                      {s?.status === "rejected" && (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-950/60 dark:text-red-200">
                          差戻し
                        </span>
                      )}
                      {!s && (
                        <span className="text-zinc-400">未提出</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
