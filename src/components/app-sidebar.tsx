"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Bot,
  ClipboardCheck,
  Download,
  ClipboardList,
  Coins,
  FileSearch,
  FileText,
  Home,
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
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
      }`}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="flex-1">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
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
    <p className="mb-1 mt-4 flex items-center gap-2 px-3 text-xs font-semibold tracking-wide text-zinc-400 first:mt-0 dark:text-zinc-500">
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
}: AppSidebarProps) {
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">LENARD HR</p>
        <p className="mt-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{userLabel}</p>
        {tenantName ? (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{tenantName}</p>
        ) : null}
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 pb-8"
        aria-label="メインメニュー"
      >
        <SectionLabel>マイページ</SectionLabel>
        <NavLink href="/my" label="ホーム" icon={Home} exact />
        <NavLink
          href="/my/attendance"
          label="勤怠"
          icon={Timer}
          pathPrefixes={["/my/attendance"]}
        />
        <NavLink
          href="/my/expenses/new"
          label="経費申請"
          icon={Receipt}
          pathPrefixes={["/my/expenses/new"]}
        />
        <NavLink
          href="/my/expenses"
          label="申請状況"
          icon={ClipboardList}
          pathPrefixes={["/my/expenses"]}
          excludePrefixes={["/my/expenses/new"]}
        />
        {showMyIncentiveNav ? (
          <NavLink
            href="/my/incentive"
            label="インセンティブ"
            icon={Coins}
            pathPrefixes={["/my/incentive"]}
            badgeCount={incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined}
          />
        ) : null}
        <NavLink href="/my/payslip" label="給与明細" icon={Banknote} exact />
        <NavLink href="/my/leave" label="有給・休暇" icon={Umbrella} pathPrefixes={["/my/leave"]} />
        <NavLink
          href="/my/contract"
          label="契約内容"
          icon={FileText}
          pathPrefixes={["/my/contract"]}
        />
        <NavLink
          href="/hr-ai"
          label="AI相談窓口"
          icon={Bot}
          pathPrefixes={["/hr-ai", "/my/hr-ai"]}
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
            <SectionLabel>管理</SectionLabel>
            <p className="px-3 pb-1 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
              owner / approver のみ
            </p>
            <NavLink href="/dashboard" label="管理ダッシュボード" icon={BarChart3} exact />
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
              icon={Coins}
              pathPrefixes={["/incentives"]}
              badgeCount={
                incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined
              }
            />
            <NavLink href="/employees" label="従業員管理" icon={Users} pathPrefixes={["/employees"]} />
            <NavLink
              href="/expenses/audit"
              label="経費審査"
              icon={FileSearch}
              pathPrefixes={["/expenses/audit"]}
            />
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
              href="/settings/export"
              label="データ出力"
              icon={Download}
              pathPrefixes={["/settings/export"]}
            />
            <NavLink
              href="/settings"
              label="設定"
              icon={Settings}
              pathPrefixes={["/settings"]}
              excludePrefixes={["/settings/auto-approval", "/settings/export"]}
            />
          </>
        ) : (
          <p className="px-3 pt-6 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
            管理メニューは承認権限のアカウントでログインすると表示されます。
          </p>
        )}
      </nav>
    </aside>
  );
}
