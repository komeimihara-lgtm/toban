import { IncentiveDeptWorkbench } from "@/components/incentive/incentive-dept-workbench";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

  if (!user) redirect("/login");

  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (selfProfile as { role?: string } | null)?.role ?? "staff";
  if (!isAdminRole(role)) {
    redirect("/my/incentive");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            インセンティブ（計算・提出）
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            営業部・サービス部タブで売上を入力し、率は設定画面の月次{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">incentive_rates</code>{" "}
            を参照します。
          </p>
        </div>
        <Link
          href="/incentives/history"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          支給履歴 →
        </Link>
      </header>

      <IncentiveDeptWorkbench />
    </div>
  );
}
