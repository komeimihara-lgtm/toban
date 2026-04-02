import { MyIncentiveDealsClient, type MyDealRow } from "@/components/incentive/my-incentive-deals-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isIncentiveEligible, type ProfileRow } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function lastNMonths(n: number) {
  const out: { year: number; month: number }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ year: t.getFullYear(), month: t.getMonth() + 1 });
  }
  return out;
}

function inMonthWindow(
  y: number,
  m: number,
  months: { year: number; month: number }[],
) {
  return months.some((w) => w.year === y && w.month === m);
}

function expandDealRows(
  d: Record<string, unknown>,
  userId: string,
): MyDealRow[] {
  const rows: MyDealRow[] = [];
  const base = {
    id: String(d.id),
    year: Number(d.year),
    month: Number(d.month),
    salon_name: String(d.salon_name ?? ""),
    machine_type: String(d.machine_type ?? ""),
    payment_status: String(d.payment_status ?? ""),
    payment_date: (d.payment_date as string | null) ?? null,
  };
  if (d.appo_employee_id === userId) {
    rows.push({
      ...base,
      role: "appo",
      role_label: "アポ",
      amount: Number(d.appo_incentive ?? 0),
    });
  }
  if (d.closer_employee_id === userId) {
    rows.push({
      ...base,
      role: "closer",
      role_label: "クローザー",
      amount: Number(d.closer_incentive ?? 0),
    });
  }
  if (d.hito_employee_id === userId) {
    rows.push({
      ...base,
      role: "hito",
      role_label: "ヒト幹",
      amount: Number(d.hito_incentive ?? 0),
    });
  }
  return rows;
}

export default async function MyIncentivePage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Supabase の環境変数（NEXT_PUBLIC_SUPABASE_URL /
        NEXT_PUBLIC_SUPABASE_ANON_KEY）を設定してください。
      </p>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_sales_target, is_service_target")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        プロフィールの取得に失敗しました。管理者に連絡してください。
      </p>
    );
  }

  const p = profile as ProfileRow;
  if (!isIncentiveEligible(p)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          あなたはインセンティブ対象外です
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          営業・サービス対象（is_sales_target / is_service_target）のいずれかが有効な社員のみこの画面を利用できます。
        </p>
      </div>
    );
  }

  const months = lastNMonths(4);

  const { data: dealRows, error: dealsErr } = await supabase
    .from("deals")
    .select(
      "id, year, month, salon_name, machine_type, payment_status, payment_date, appo_employee_id, closer_employee_id, hito_employee_id, appo_incentive, closer_incentive, hito_incentive",
    )
    .or(`appo_employee_id.eq.${user.id},closer_employee_id.eq.${user.id},hito_employee_id.eq.${user.id}`)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(300);

  if (dealsErr) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        案件の取得に失敗しました: {dealsErr.message}
      </p>
    );
  }

  const flat: MyDealRow[] = [];
  for (const d of dealRows ?? []) {
    if (!inMonthWindow(Number((d as { year: number }).year), Number((d as { month: number }).month), months)) {
      continue;
    }
    flat.push(...expandDealRows(d as Record<string, unknown>, user.id));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          マイインセンティブ（案件ベース）
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {p.full_name ?? "—"} さんの担当案件に基づくインセンティブです。計算は販売価格（税込）÷1.1 −
          実質原価による純利益に、機種別レートを掛けて算出されています。
        </p>
      </header>

      <MyIncentiveDealsClient initialDeals={flat} months={months} />
    </div>
  );
}
