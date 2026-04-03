import { AutoApprovalRulesForm } from "@/components/settings/auto-approval-rules-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AutoApprovalSettingsPage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const pr = emp as { role?: string; company_id?: string } | null;
  const role = pr?.role ?? "staff";
  const companyId = pr?.company_id;
  if (role !== "owner" || !companyId) {
    redirect("/my");
  }

  const { data: rules } = await supabase
    .from("auto_approval_rules")
    .select("id, category, max_amount, per_person, is_enabled")
    .eq("company_id", companyId)
    .order("category", { ascending: true });

  const list = (rules ?? []) as {
    id: string;
    category: string;
    max_amount: number | null;
    per_person: boolean;
    is_enabled: boolean;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link
          href="/settings"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400"
        >
          ← 設定トップ
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          自動承認ルール
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          カテゴリごとの上限と「1人あたり」判定を設定します。編集できるのは
          <span className="font-medium"> owner</span> のみです。
        </p>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          ルールがまだありません。最新の DB マイグレーション（014_auto_approval_rules.sql）を適用すると、デフォルト行が作成されます。
        </p>
      ) : (
        <AutoApprovalRulesForm initialRules={list} />
      )}
    </div>
  );
}
