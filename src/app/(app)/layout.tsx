import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LENARD HR",
  description: "レナード株式会社 人事・勤怠",
};

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userLabel = "未ログイン";
  let incentiveHref: "/my/incentive" | "/incentives" = "/my/incentive";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        const name =
          (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
          user.email ||
          user.id.slice(0, 8);
        userLabel = name;

        const role = (profile as { role?: string } | null)?.role ?? "staff";
        incentiveHref = isAdminRole(role) ? "/incentives" : "/my/incentive";
      }
    } catch {
      userLabel = "接続エラー";
    }
  }

  return (
    <div className="flex min-h-0 min-h-screen flex-1">
      <AppSidebar incentiveHref={incentiveHref} userLabel={userLabel} />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
