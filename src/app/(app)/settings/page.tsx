import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/api-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function resolveRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return (data as { role?: string } | null)?.role ?? "staff";
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);
  if (!isOwner(role)) redirect("/my");

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">
          設定
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          店舗の基本設定を管理します
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1A1A1A]">
          店舗設定
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          店舗名・通知チャネルなどの基本設定を変更します。
        </p>
        <div className="mt-4">
          <Link
            href="/settings/tenant"
            className="text-sm font-medium text-[#FF6B2B] underline hover:text-[#FF8C00]"
          >
            店舗設定を開く →
          </Link>
        </div>
      </section>
    </div>
  );
}
