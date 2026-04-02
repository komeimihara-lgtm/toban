import { MyDealsIncentiveWorkbench } from "@/components/incentive/my-deals-incentive-workbench";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isIncentiveEligible, type ProfileRow } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          マイインセンティブ（案件）
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          案件を入力し、下書き保存のあと提出してください。管理者が承認すると確定です。純利益は
          販売価格（税込）÷1.1 − 実質原価です。
        </p>
      </header>

      <MyDealsIncentiveWorkbench userId={user.id} userName={p.full_name} />
    </div>
  );
}
