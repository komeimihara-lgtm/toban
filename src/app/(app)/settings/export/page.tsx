import { LaborExportPanel } from "@/components/settings/labor-export-panel";
import { createClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/require-admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkAdminRole(supabase, user.id))) redirect("/my");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/settings"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 設定に戻る
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">データ出力</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          owner / approver のみ利用できます。
        </p>
      </header>
      <LaborExportPanel />
    </div>
  );
}
