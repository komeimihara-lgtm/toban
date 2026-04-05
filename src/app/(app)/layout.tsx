import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TOBAN",
  description: "お店とバイトをつなぐ、当番管理アプリ",
};

async function fetchEmployeeRowForAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const empCols = "id, role, name, company_id";
  const { data: byAuth } = await supabase
    .from("employees")
    .select(empCols)
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (byAuth) return byAuth;
  const { data: byUser } = await supabase
    .from("employees")
    .select(empCols)
    .eq("user_id", userId)
    .maybeSingle();
  return byUser ?? null;
}

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userLabel = "未ログイン";
  let showAdminSection = false;
  let tenantName: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const emp = await fetchEmployeeRowForAuthUser(supabase, user.id);

        const cid = (emp as { company_id?: string } | null)?.company_id;

        const name =
          (emp as { name?: string | null } | null)?.name?.trim() ?? "";
        userLabel = name || "氏名未登録";

        const role =
          (emp as { role?: string | null } | null)?.role ?? "staff";
        showAdminSection = role === "owner";

        if (cid) {
          const { data: co } = await supabase
            .from("companies")
            .select("name")
            .eq("id", cid)
            .maybeSingle();
          tenantName =
            (co as { name?: string } | null)?.name ?? null;
        }
      }
    } catch {
      userLabel = "接続エラー";
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <AppSidebar
        userLabel={userLabel}
        tenantName={tenantName}
        showAdminSection={showAdminSection}
      />
      <main className="print-full text-foreground min-w-0 flex-1 overflow-y-auto px-4 pb-20 pt-6 md:p-10 md:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
