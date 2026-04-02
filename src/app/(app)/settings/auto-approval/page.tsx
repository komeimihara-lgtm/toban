import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMPANY_ID } from "@/lib/company";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AutoApprovalSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "staff";
  if (!isAdminRole(role)) redirect("/my");

  const isOwner = role === "owner";

  const { data: rules } = await supabase
    .from("auto_approval_rules")
    .select("id, rule_name, max_amount, is_active, created_at")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .order("created_at", { ascending: false });

  const list = (rules ?? []) as {
    id: string;
    rule_name: string;
    max_amount: number | null;
    is_active: boolean;
    created_at: string;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
          経費の金額別ルール（登録・更新は owner のみ DB ポリシー上可能です）。
        </p>
        {!isOwner && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            第1承認者として一覧のみ参照できます。変更が必要な場合は owner に依頼してください。
          </p>
        )}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500">
              ルールがまだありません。必要に応じて owner が Supabase または今後の画面から登録します。
            </li>
          )}
          {list.map((r) => (
            <li key={r.id} className="px-6 py-4">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {r.rule_name}
                {!r.is_active && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    停止中
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                上限額:{" "}
                {r.max_amount != null
                  ? `${Number(r.max_amount).toLocaleString("ja-JP")} 円`
                  : "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
