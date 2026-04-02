"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Bot,
  ClipboardCheck,
  Clock,
  Coins,
  FileText,
  Home,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Umbrella,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type AppSidebarProps = {
  userLabel: string;
  showIncentiveLink: boolean;
  showOnboardingLink: boolean;
  showAdminSection: boolean;
};

function NavLink({
  href,
  label,
  icon: Icon,
  pathPrefixes,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathPrefixes?: string[];
}) {
  const pathname = usePathname();
  const active = pathPrefixes?.length
    ? pathPrefixes.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      )
    : pathname === href || pathname.startsWith(`${href}/`);

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
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-4 px-3 text-xs font-semibold tracking-wide text-zinc-400 first:mt-0 dark:text-zinc-500">
      {children}
    </p>
  );
}

export function AppSidebar({
  userLabel,
  showIncentiveLink,
  showOnboardingLink,
  showAdminSection,
}: AppSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          LENARD HR
        </p>
        <p className="mt-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
          {userLabel}
        </p>
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 pb-8"
        aria-label="メインメニュー"
      >
        <SectionLabel>マイページ</SectionLabel>
        <NavLink href="/my" label="ホーム" icon={Home} />
        <NavLink
          href="/my/attendance"
          label="勤怠"
          icon={Clock}
          pathPrefixes={["/my/attendance", "/attendance"]}
        />
        <NavLink href="/my/expenses" label="経費申請" icon={Receipt} />
        <NavLink href="/my/expenses" label="申請状況" icon={ListChecks} />
        {showIncentiveLink && (
          <NavLink href="/my/incentive" label="インセンティブ" icon={Coins} />
        )}
        <NavLink href="/my/payslip" label="給与明細" icon={Banknote} />
        <NavLink href="/my/leave" label="有給・休暇" icon={Umbrella} />
        <NavLink href="/hr-ai" label="AI相談窓口" icon={Bot} />
        <NavLink href="/my/contract" label="契約内容" icon={FileText} />
        <NavLink href="/my/profile" label="プロフィール設定" icon={User} />
        {showOnboardingLink && (
          <NavLink href="/onboarding" label="入社手続き" icon={UserPlus} />
        )}

        {showAdminSection && (
          <>
            <SectionLabel>管理</SectionLabel>
            <NavLink
              href="/dashboard"
              label="管理ダッシュボード"
              icon={LayoutDashboard}
            />
            <NavLink href="/approval" label="承認" icon={ClipboardCheck} />
            <NavLink
              href="/incentives"
              label="インセンティブ管理"
              icon={Coins}
              pathPrefixes={["/incentives"]}
            />
            <NavLink href="/employees" label="従業員管理" icon={Users} />
            <NavLink
              href="/expenses/audit"
              label="経費審査"
              icon={Receipt}
            />
            <NavLink
              href="/onboarding/admin"
              label="入退社手続き"
              icon={UserPlus}
            />
            <NavLink
              href="/settings/auto-approval"
              label="自動承認ルール"
              icon={Settings}
            />
            <NavLink href="/settings" label="設定" icon={Settings} />
          </>
        )}
      </nav>
    </aside>
  );
}
