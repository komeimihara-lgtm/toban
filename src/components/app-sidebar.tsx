"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Download,
  FileSearch,
  FileText,
  Home,
  LayoutDashboard,
  Receipt,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type AppSidebarProps = {
  userLabel: string;
  tenantName?: string | null;
  showMyIncentiveNav: boolean;
  showAdminSection: boolean;
  showEmployeeOnboardingNav?: boolean;
  approvalBadgeCount?: number;
  incentiveDraftBadgeCount?: number;
  /** owner/approver は `/`、その他は `/my` */
  dashboardHref: string;
  /** 全社一覧 `/expenses` or 個人 `/my/expenses` */
  expensesListHref: string;
};

function NavLink({
  href,
  label,
  icon: Icon,
  pathPrefixes,
  excludePrefixes,
  badgeCount,
  exact = false,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathPrefixes?: string[];
  excludePrefixes?: string[];
  badgeCount?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const excludedByPrefix = excludePrefixes?.some(
    (e) => pathname === e || pathname.startsWith(`${e}/`),
  );

  let active = false;
  if (!excludedByPrefix) {
    if (exact) {
      active = pathname === href;
    } else if (pathPrefixes?.length) {
      active = pathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    } else {
      active = pathname === href || pathname.startsWith(`${href}/`);
    }
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold leading-snug transition-colors ${
        active
          ? "border border-accent/50 bg-accent/15 text-accent shadow-sm dark:border-transparent dark:bg-[var(--sidebar-active-bg)] dark:text-[var(--foreground)] dark:shadow-none"
          : "border border-transparent text-zinc-800 hover:bg-slate-200/80 hover:text-zinc-950 dark:text-[var(--sidebar-muted)] dark:hover:bg-white/10"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${active ? "text-accent opacity-100 dark:text-[var(--foreground)]" : "text-zinc-600 dark:text-[var(--sidebar-muted)]"}`}
        aria-hidden
      />
      <span className="flex-1">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums dark:bg-amber-500">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({
  children,
  badgeCount,
}: {
  children: ReactNode;
  badgeCount?: number;
}) {
  return (
    <p className="mb-1.5 mt-5 flex items-center gap-2 px-3 text-[11px] font-bold tracking-[0.06em] text-zinc-700 normal-case dark:text-[var(--sidebar-muted)] first:mt-0">
      <span>{children}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className="rounded-full bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums dark:bg-amber-500">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </p>
  );
}

export function AppSidebar({
  userLabel,
  tenantName,
  showMyIncentiveNav,
  showAdminSection,
  showEmployeeOnboardingNav = false,
  approvalBadgeCount = 0,
  incentiveDraftBadgeCount = 0,
  dashboardHref,
  expensesListHref,
}: AppSidebarProps) {
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--background-sidebar)]">
      <div className="border-b border-[var(--sidebar-border)] px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">LENARD HR</p>
        <p className="mt-1 truncate text-sm text-zinc-900 dark:text-[var(--foreground)]">{userLabel}</p>
        {tenantName ? (
          <p className="mt-1 truncate text-xs text-zinc-600 dark:text-[var(--sidebar-muted)]">{tenantName}</p>
        ) : null}
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 pb-8"
        aria-label="メインメニュー"
      >
        {showAdminSection ? (
          <>
            <SectionLabel>管理</SectionLabel>
            <NavLink
              href="/"
              label="管理ダッシュボード"
              icon={LayoutDashboard}
              pathPrefixes={["/", "/dashboard"]}
            />
            <NavLink
              href="/approval"
              label="承認"
              icon={ClipboardCheck}
              pathPrefixes={["/approval"]}
              badgeCount={approvalBadgeCount > 0 ? approvalBadgeCount : undefined}
            />
            <NavLink
              href="/incentives"
              label="インセンティブ管理"
              icon={BarChart3}
              pathPrefixes={["/incentives"]}
              excludePrefixes={["/incentives/history"]}
              badgeCount={
                incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined
              }
            />
            <NavLink
              href="/incentives/history"
              label="インセンティブ支給履歴"
              icon={BarChart3}
              pathPrefixes={["/incentives/history"]}
            />
            <NavLink
              href="/employees"
              label="従業員管理"
              icon={Users}
              pathPrefixes={["/employees"]}
            />
            <NavLink
              href="/expenses/audit"
              label="経費審査"
              icon={FileSearch}
              pathPrefixes={["/expenses/audit"]}
            />
            <NavLink
              href="/expenses/new"
              label="経費・新規申請"
              icon={Receipt}
              pathPrefixes={["/expenses/new"]}
            />
            <NavLink
              href={expensesListHref}
              label="経費・申請一覧"
              icon={ClipboardList}
              pathPrefixes={
                expensesListHref === "/expenses"
                  ? ["/expenses"]
                  : ["/my/expenses"]
              }
              excludePrefixes={["/expenses/new", "/expenses/audit", "/my/expenses/new"]}
            />
            <NavLink
              href="/onboarding/admin"
              label="入退社手続き"
              icon={ClipboardList}
              pathPrefixes={["/onboarding/admin"]}
            />
            <NavLink
              href="/settings/auto-approval"
              label="自動承認ルール"
              icon={SlidersHorizontal}
              pathPrefixes={["/settings/auto-approval"]}
            />
            <NavLink
              href="/settings"
              label="設定"
              icon={Settings}
              pathPrefixes={["/settings"]}
              excludePrefixes={[
                "/settings/auto-approval",
                "/settings/export",
                "/settings/hr",
                "/settings/tenant",
              ]}
            />
            <NavLink
              href="/settings/hr"
              label="人事設定"
              icon={Settings}
              pathPrefixes={["/settings/hr"]}
            />
            <NavLink
              href="/settings/tenant"
              label="テナント・会社設定"
              icon={Building2}
              pathPrefixes={["/settings/tenant"]}
            />
            <NavLink
              href="/settings/export"
              label="月次データ出力"
              icon={Download}
              pathPrefixes={["/settings/export"]}
            />
          </>
        ) : null}

        <SectionLabel>マイページ</SectionLabel>
        <NavLink href="/my" label="ホーム" icon={Home} exact />
        <NavLink
          href="/my/attendance"
          label="勤怠"
          icon={Timer}
          pathPrefixes={["/my/attendance"]}
        />
        <NavLink
          href="/my/expenses"
          label="経費申請"
          icon={ClipboardList}
          pathPrefixes={["/my/expenses"]}
          excludePrefixes={["/expenses", "/expenses/new"]}
        />
        <NavLink href="/my/payslip" label="給与明細" icon={Banknote} exact />
        <NavLink href="/my/leave" label="有給・休暇" icon={Umbrella} pathPrefixes={["/my/leave"]} />
        {showMyIncentiveNav ? (
          <NavLink
            href="/my/incentive"
            label="インセンティブ申請"
            icon={Coins}
            pathPrefixes={["/my/incentive"]}
            badgeCount={incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined}
          />
        ) : null}
        <NavLink
          href="/hr-ai"
          label="AI相談窓口"
          icon={Sparkles}
          pathPrefixes={["/hr-ai", "/my/hr-ai"]}
        />
        <NavLink
          href="/my/contract"
          label="契約内容"
          icon={FileText}
          pathPrefixes={["/my/contract"]}
        />
        {showEmployeeOnboardingNav ? (
          <NavLink
            href="/onboarding"
            label="入社手続き"
            icon={UserPlus}
            pathPrefixes={["/onboarding"]}
            excludePrefixes={["/onboarding/admin"]}
          />
        ) : null}
        <NavLink
          href="/my/profile"
          label="プロフィール設定"
          icon={UserCircle}
          pathPrefixes={["/my/profile"]}
        />
      </nav>
    </aside>
  );
}
