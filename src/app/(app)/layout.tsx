import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { shouldShowOnboardingLink } from "@/lib/sidebar-flags";
import {
  isAdminRole,
  isIncentiveEligible,
  type ProfileRow,
} from "@/types/incentive";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LENARD HR",
  description: "レナード株式会社 人事・勤怠",
};

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userLabel = "未ログイン";
  let showIncentiveLink = false;
  let showOnboardingLink = false;
  let showAdminSection = false;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "full_name, role, is_sales_target, is_service_target",
          )
          .eq("id", user.id)
          .maybeSingle();

        const name =
          (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
          user.email ||
          user.id.slice(0, 8);
        userLabel = name;

        const role = (profile as { role?: string } | null)?.role ?? "staff";
        showAdminSection = isAdminRole(role);

        const p = profile as ProfileRow | null;
        if (p && isIncentiveEligible(p)) {
          showIncentiveLink = true;
        }

        showOnboardingLink = await shouldShowOnboardingLink(supabase, user.id);
      }
    } catch {
      userLabel = "接続エラー";
    }
  }

  return (
    <div className="flex min-h-0 min-h-screen flex-1">
      <AppSidebar
        userLabel={userLabel}
        showIncentiveLink={showIncentiveLink}
        showOnboardingLink={showOnboardingLink}
        showAdminSection={showAdminSection}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
