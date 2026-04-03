import { AppSidebar } from "@/components/app-sidebar";
import { countExpenseApprovalBadges } from "@/lib/overview-stats";
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

async function countDealDraftBadges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { userId: string; companyId: string; isAdmin: boolean },
) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  try {
    if (opts.isAdmin) {
      const { count } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("company_id", opts.companyId)
        .eq("year", y)
        .eq("month", m)
        .eq("submit_status", "draft");
      return count ?? 0;
    }
    const { count } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .or(`appo_employee_id.eq.${opts.userId},closer_employee_id.eq.${opts.userId}`)
      .in("submit_status", ["draft", "rejected"])
      .eq("year", y)
      .eq("month", m);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function shouldShowEmployeeOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const { data: emp } = await supabase
      .from("employees")
      .select("id, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!emp) return false;
    const createdAt = new Date((emp as { created_at: string }).created_at);
    const daysSince = (Date.now() - createdAt.getTime()) / 86400000;
    if (daysSince <= 30) return true;
    const empId = (emp as { id: string }).id;
    const { count } = await supabase
      .from("onboarding_tasks")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", empId)
      .eq("completed", false);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userLabel = "未ログイン";
  let showAdminSection = false;
  let approvalBadgeCount = 0;
  let incentiveDraftBadgeCount = 0;
  let showMyIncentiveNav = false;
  let showEmployeeOnboardingNav = false;
  let tenantName: string | null = null;
  let dashboardHref = "/my";
  let expensesListHref = "/my/expenses";

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
        if (showAdminSection) {
          dashboardHref = "/";
          expensesListHref = "/expenses";
        }

        const p = profile as ProfileRow | null;
        const { data: empIncentive } = await supabase
          .from("employees")
          .select("is_sales_target, is_service_target")
          .eq("user_id", user.id)
          .maybeSingle();
        if (empIncentive) {
          const er = empIncentive as {
            is_sales_target: boolean;
            is_service_target: boolean;
          };
          showMyIncentiveNav = er.is_sales_target || er.is_service_target;
        } else {
          showMyIncentiveNav = Boolean(p && isIncentiveEligible(p));
        }

        showEmployeeOnboardingNav = await shouldShowEmployeeOnboarding(supabase, user.id);

        if (showAdminSection) {
          try {
            approvalBadgeCount = await countExpenseApprovalBadges(supabase, role);
          } catch {
            approvalBadgeCount = 0;
          }
        }

        if (cid) {
          try {
            const dealDraft = await countDealDraftBadges(supabase, {
              userId: user.id,
              companyId: cid,
              isAdmin: showAdminSection,
            });
            incentiveDraftBadgeCount = dealDraft;
          } catch {
            incentiveDraftBadgeCount = 0;
          }
        }
      }
    } catch {
      userLabel = "接続エラー";
    }
  }

  return (
    <div className="flex min-h-0 min-h-screen flex-1 bg-[var(--background)] text-[var(--foreground)]">
      <AppSidebar
        userLabel={userLabel}
        tenantName={tenantName}
        showMyIncentiveNav={showMyIncentiveNav}
        showAdminSection={showAdminSection}
        showEmployeeOnboardingNav={showEmployeeOnboardingNav}
        approvalBadgeCount={approvalBadgeCount}
        incentiveDraftBadgeCount={incentiveDraftBadgeCount}
        dashboardHref={dashboardHref}
        expensesListHref={expensesListHref}
      />
      <main className="print-full text-foreground min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
