import { DealsAdminClient } from "@/components/incentive/deals-admin-client";
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

  const { data: selfProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const role = (selfProfile as { role?: string } | null)?.role ?? "staff";
  if (!isAdminRole(role)) {
    redirect("/my/incentive");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            インセンティブ（案件・集計）
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            社員が提出した案件を承認・差戻しします。純利益（販売税込÷1.1 − 実質原価）に機種別レートを掛けてアポ・クローザーのインセンティブを計算します。エイトキューブはアポ・クローザー
            各5%、その他既定機種と「その他」は各4%です。
          </p>
        </div>
        <Link
          href="/incentives/history"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          旧・支給履歴 →
        </Link>
      </header>

      <DealsAdminClient />
    </div>
  );
}
