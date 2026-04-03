"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Bot,
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
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border border-accent/40 bg-accent/15 text-accent"
          : "border border-transparent text-zinc-600 hover:bg-slate-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
      }`}
    >
      <Icon className="size-4 shrink-0 opacity-85" aria-hidden />
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
    <p className="mb-1 mt-4 flex items-center gap-2 px-3 text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-500 first:mt-0">
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
  const showIncentiveBlock = showMyIncentiveNav || showAdminSection;

  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--surface-sidebar)]">
      <div className="border-b border-[var(--sidebar-border)] px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">LENARD HR</p>
        <p className="mt-1 truncate text-sm text-zinc-900 dark:text-zinc-100">{userLabel}</p>
        {tenantName ? (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-500">{tenantName}</p>
        ) : null}
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 pb-8"
        aria-label="メインメニュー"
      >
        <SectionLabel>経費精算</SectionLabel>
        <NavLink
          href={dashboardHref}
          label="ダッシュボード"
          icon={LayoutDashboard}
          pathPrefixes={[dashboardHref]}
          exact
        />
        <NavLink
          href="/expenses/new"
          label="新規申請"
          icon={Receipt}
          pathPrefixes={["/expenses/new", "/my/expenses/new"]}
        />
        <NavLink
          href={expensesListHref}
          label="申請一覧"
          icon={ClipboardList}
          pathPrefixes={
            expensesListHref === "/expenses"
              ? ["/expenses", "/my/expenses"]
              : ["/my/expenses"]
          }
          excludePrefixes={["/expenses/new", "/my/expenses/new"]}
        />
        {showAdminSection ? (
          <NavLink
            href="/approval"
            label="承認"
            icon={ClipboardCheck}
            pathPrefixes={["/approval"]}
            badgeCount={approvalBadgeCount > 0 ? approvalBadgeCount : undefined}
          />
        ) : null}

        {showIncentiveBlock ? (
          <>
            <SectionLabel badgeCount={incentiveDraftBadgeCount}>
              インセンティブ
            </SectionLabel>
            {showMyIncentiveNav ? (
              <NavLink
                href="/my/incentive"
                label="計算・提出"
                icon={Coins}
                pathPrefixes={["/my/incentive"]}
                badgeCount={incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined}
              />
            ) : null}
            {showAdminSection ? (
              <NavLink
                href="/incentives"
                label="管理・承認"
                icon={BarChart3}
                pathPrefixes={["/incentives"]}
                excludePrefixes={["/incentives/history"]}
                badgeCount={
                  incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined
                }
              />
            ) : null}
            {(showMyIncentiveNav || showAdminSection) && (
              <NavLink
                href="/settings"
                label="設定（率・マスタ）"
                icon={Settings}
            pathPrefixes={["/settings"]}
            excludePrefixes={[
              "/settings/auto-approval",
              "/settings/export",
              "/settings/hr",
              "/settings/tenant",
            ]}
              />
            )}
            <NavLink
              href="/incentives/history"
              label="支給履歴"
              icon={BarChart3}
              pathPrefixes={["/incentives/history"]}
            />
          </>
        ) : null}

        <SectionLabel>✦ AI人事</SectionLabel>
        <NavLink
          href="/hr-ai"
          label="✦ AI人事アシスタント"
          icon={Bot}
          pathPrefixes={["/hr-ai", "/my/hr-ai"]}
        />
        <p className="px-3 pt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
          相談内容は共有しませんので、何度もご相談ください。必要なときは画面から代表へ要約送信ができます。
        </p>

        <SectionLabel>レポート</SectionLabel>
        {showAdminSection ? (
          <NavLink
            href="/settings/export"
            label="月次データ出力"
            icon={Download}
            pathPrefixes={["/settings/export"]}
          />
        ) : null}
        {showAdminSection ? (
          <NavLink
            href="/expenses/audit"
            label="経費審査"
            icon={FileSearch}
            pathPrefixes={["/expenses/audit"]}
          />
        ) : null}
        {!showAdminSection ? (
          <p className="px-3 pt-1 text-[10px] leading-tight text-zinc-500">
            月次レポート・経費審査は承認権限のアカウントで表示されます。
          </p>
        ) : null}

        <SectionLabel>マイ業務</SectionLabel>
        <NavLink href="/my" label="マイホーム" icon={Home} exact />
        <NavLink
          href="/my/attendance"
          label="勤怠"
          icon={Timer}
          pathPrefixes={["/my/attendance"]}
        />
        <NavLink href="/my/payslip" label="給与明細" icon={Banknote} exact />
        <NavLink href="/my/leave" label="有給・休暇" icon={Umbrella} pathPrefixes={["/my/leave"]} />
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

        {showAdminSection ? (
          <>
            <SectionLabel>システム管理</SectionLabel>
            <p className="px-3 pb-1 text-[10px] leading-tight text-zinc-500">owner / approver</p>
            <NavLink href="/employees" label="従業員管理" icon={Users} pathPrefixes={["/employees"]} />
            <NavLink
              href="/onboarding/admin"
              label="入退社手続き"
              icon={UserPlus}
              pathPrefixes={["/onboarding/admin"]}
            />
            <NavLink
              href="/settings/auto-approval"
              label="自動承認ルール"
              icon={SlidersHorizontal}
              pathPrefixes={["/settings/auto-approval"]}
            />
            <NavLink
              href="/settings/hr"
              label="人事設定"
              icon={Settings}
              pathPrefixes={["/settings/hr"]}
            />
          </>
        ) : null}
      </nav>
    </aside>
  );
}
