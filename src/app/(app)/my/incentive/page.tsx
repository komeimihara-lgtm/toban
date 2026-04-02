import { IncentiveSelfForm } from "@/components/incentive/incentive-self-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  isIncentiveEligible,
  type IncentiveRateRow,
  type IncentiveSubmissionRow,
  type ProfileRow,
} from "@/types/incentive";

export const dynamic = "force-dynamic";

function currentYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
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

  if (!user) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        ログインが必要です。
      </p>
    );
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, is_sales_target, is_service_target",
    )
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
          営業・サービス対象フラグがどちらも無効のため、この画面は利用できません。
        </p>
      </div>
    );
  }

  const ym = currentYearMonth();

  const { data: rateRow } = await supabase
    .from("incentive_rates")
    .select("id, rate, formula_type, year_month")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  const rate = rateRow as IncentiveRateRow | null;

  const { data: submission } = await supabase
    .from("incentive_submissions")
    .select(
      "id, sales_amount, status, submitted_at, rate_snapshot, selling_price_tax_in, actual_cost, service_cost_deduction, deal_role, net_profit_ex_tax, product_id",
    )
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  const sub = submission as
    | Pick<
        IncentiveSubmissionRow,
        | "id"
        | "sales_amount"
        | "status"
        | "submitted_at"
        | "rate_snapshot"
        | "selling_price_tax_in"
        | "actual_cost"
        | "service_cost_deduction"
        | "deal_role"
        | "net_profit_ex_tax"
        | "product_id"
      >
    | null;

  const { data: historyRows } = await supabase
    .from("incentive_submissions")
    .select("year_month, sales_amount, rate_snapshot, status")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("year_month", { ascending: false })
    .limit(3);

  const history =
    (historyRows as {
      year_month: string;
      sales_amount: number | null;
      rate_snapshot: number | null;
      status: string;
    }[]) ?? [];

  if (!rate) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          マイインセンティブ
        </h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          {ym} 分のインセンティブ率が未設定です。管理者が
          <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">
            incentive_rates
          </code>
          に登録するまでお待ちください。
        </p>
      </div>
    );
  }

  return (
    <IncentiveSelfForm
      yearMonth={ym}
      rate={Number(rate.rate)}
      formulaType={rate.formula_type ?? "fixed_rate"}
      submission={sub}
      history={history}
    />
  );
}
