import { AppSidebar } from "@/components/app-sidebar";
import { countExpenseApprovalBadges } from "@/lib/overview-stats";
import { shouldShowOnboardingNav } from "@/lib/sidebar-onboarding";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
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
  let showAdminSection = false;
  let approvalBadgeCount = 0;
  let incentiveDraftBadgeCount = 0;
  let showMyIncentiveNav = false;
  let showOnboardingNav = false;
  let tenantName: string | null = null;

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
            "full_name, role, company_id, is_sales_target, is_service_target",
          )
          .eq("id", user.id)
          .maybeSingle();

        const cid = (profile as { company_id?: string } | null)?.company_id;
        if (cid) {
          const { data: co } = await supabase
            .from("companies")
            .select("name")
            .eq("id", cid)
            .maybeSingle();
          tenantName = (co as { name?: string } | null)?.name ?? null;
        }

        const name =
          (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
          user.email ||
          user.id.slice(0, 8);
        userLabel = name;

        const role = (profile as { role?: string } | null)?.role ?? "staff";
        showAdminSection = isAdminRole(role);

        const p = profile as ProfileRow | null;
        showMyIncentiveNav = Boolean(p && isIncentiveEligible(p));

        try {
          showOnboardingNav = await shouldShowOnboardingNav(supabase, user.id);
        } catch {
          showOnboardingNav = false;
        }

        if (showAdminSection) {
          try {
            approvalBadgeCount = await countExpenseApprovalBadges(supabase, role);
          } catch {
            approvalBadgeCount = 0;
          }
        }

        if (p && isIncentiveEligible(p)) {
          try {
            const now = new Date();
            const { count } = await supabase
              .from("incentive_configs")
              .select("*", { count: "exact", head: true })
              .eq("employee_id", user.id)
              .eq("status", "draft")
              .eq("year", now.getFullYear())
              .eq("month", now.getMonth() + 1);
            incentiveDraftBadgeCount = count ?? 0;
          } catch {
            incentiveDraftBadgeCount = 0;
          }
        }

        if (showAdminSection) {
          try {
            const now = new Date();
            const { count } = await supabase
              .from("incentive_configs")
              .select("*", { count: "exact", head: true })
              .eq("status", "draft")
              .eq("year", now.getFullYear())
              .eq("month", now.getMonth() + 1);
            if ((count ?? 0) > incentiveDraftBadgeCount) {
              incentiveDraftBadgeCount = count ?? 0;
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      userLabel = "接続エラー";
    }
  }

  return (
    <div className="flex min-h-0 min-h-screen flex-1">
      <AppSidebar
        userLabel={userLabel}
        tenantName={tenantName}
        showMyIncentiveNav={showMyIncentiveNav}
        showOnboardingNav={showOnboardingNav}
        showAdminSection={showAdminSection}
        approvalBadgeCount={approvalBadgeCount}
        incentiveDraftBadgeCount={incentiveDraftBadgeCount}
      />
      <main className="print-full min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
