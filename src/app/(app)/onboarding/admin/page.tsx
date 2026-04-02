import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingAdminPage() {
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        入退社手続き（管理）
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        入社手続きステータスの一覧・更新 UI
        は、この後のイテレーションで employees / onboarding テーブルと接続します。
      </p>
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        スタッフ向け入社手続きは <code className="text-xs">/onboarding</code>{" "}
        から利用できます。
      </p>
    </div>
  );
}
