import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { checkAdminRole } from "@/lib/require-admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkAdminRole(supabase, user.id))) {
    redirect("/my");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        ダッシュボード
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        TOBAN 管理画面です。サイドメニューから各機能にアクセスできます。
      </p>
    </div>
  );
}
