import { AppSidebar } from "@/components/app-sidebar";
import { countExpenseApprovalBadges } from "@/lib/overview-stats";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isIncentiveEligible, type ProfileRow } from "@/types/incentive";
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

async function fetchEmployeeRowForAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: byAuth } = await supabase
    .from("employees")
    .select("id, role, is_sales_target, is_service_target, created_at")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (byAuth) return byAuth;
  const { data: byUser } = await supabase
    .from("employees")
    .select("id, role, is_sales_target, is_service_target, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  return byUser ?? null;
}

async function shouldShowEmployeeOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const emp = await fetchEmployeeRowForAuthUser(supabase, userId);
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
        const emp = await fetchEmployeeRowForAuthUser(supabase, user.id);

        const profile = emp as { name?: string; role?: string; company_id?: string; is_sales_target?: boolean; is_service_target?: boolean } | null;

        const cid = (emp as { company_id?: string } | null)?.company_id;
        if (cid) {
          const { data: co } = await supabase
            .from("companies")
            .select("name")
            .eq("id", cid)
            .maybeSingle();
          tenantName = (co as { name?: string } | null)?.name ?? null;
        }

        const name =
          (profile as { name?: string | null } | null)?.name?.trim() ||
          user.email ||
          user.id.slice(0, 8);
        userLabel = name;

        const role =
          (emp as { role?: string | null } | null)?.role ??
          (profile as { role?: string } | null)?.role ??
          "staff";
        showAdminSection = role === "owner" || role === "director" || role === "approver" || role === "sr";
        if (showAdminSection) {
          dashboardHref = "/";
          expensesListHref = "/expenses";
        }

        const p = profile as ProfileRow | null;
        if (emp) {
          const er = emp as {
            is_sales_target?: boolean;
            is_service_target?: boolean;
          };
          showMyIncentiveNav = Boolean(
            er.is_sales_target || er.is_service_target,
          );
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
