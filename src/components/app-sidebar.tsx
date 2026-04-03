"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  Car,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Download,
  FileSearch,
  FileText,
  Home,
  LayoutDashboard,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

export type AppSidebarProps = {
  userLabel: string;
  tenantName?: string | null;
  showMyIncentiveNav: boolean;
  showAdminSection: boolean;
  showCheckSheetApproval?: boolean;
  showEmployeeOnboardingNav?: boolean;
  approvalBadgeCount?: number;
  incentiveDraftBadgeCount?: number;
  /** 全社一覧 `/expenses` or 個人 `/my/expenses` */
  expensesListHref: string;
  /** owner / director のみ（就業規則PDF・AI学習の管理） */
  showCompanyDocumentsAdminNav?: boolean;
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
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold leading-snug transition-colors ${
        active
          ? "border border-accent/50 bg-accent/15 text-accent shadow-sm dark:border-transparent dark:bg-[#243352] dark:text-white dark:shadow-none"
          : "border border-transparent text-zinc-800 hover:bg-slate-200/80 hover:text-zinc-950 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${active ? "text-accent opacity-100 dark:text-white" : "text-zinc-600 dark:text-white dark:group-hover:text-white"}`}
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
  variant = "blue",
}: {
  children: ReactNode;
  badgeCount?: number;
  variant?: "blue" | "emerald";
}) {
  const colors =
    variant === "emerald"
      ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-300"
      : "bg-blue-600/20 border-blue-500/30 text-blue-300";
  return (
    <p className="mb-2 mt-6 flex items-center gap-2 px-2 first:mt-0">
      <span
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${colors}`}
      >
        {children}
      </span>
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
  showCheckSheetApproval = false,
  showEmployeeOnboardingNav = false,
  approvalBadgeCount = 0,
  incentiveDraftBadgeCount = 0,
  expensesListHref,
  showCompanyDocumentsAdminNav = false,
}: AppSidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // モバイルメニュー: ページ遷移時に自動で閉じる
  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  // ボトムナビの「メニュー」ボタンからの開閉イベント
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-mobile-menu", handler);
    return () => window.removeEventListener("open-mobile-menu", handler);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      const saved = sessionStorage.getItem("sidebar-scroll");
      if (saved) {
        el.scrollTop = Number(saved);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const handleScroll = () => {
      sessionStorage.setItem("sidebar-scroll", String(el.scrollTop));
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* オーバーレイ（モバイルのみ） */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`no-print flex w-56 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--background-sidebar)]
          max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:shadow-xl
          max-md:transition-transform max-md:duration-300 max-md:ease-in-out
          ${mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}
        `}
      >
        <div className="flex items-start justify-between border-b border-[var(--sidebar-border)] px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">LENARD HR</p>
            <p className="mt-1 truncate text-sm text-zinc-900 dark:text-white">{userLabel}</p>
            {tenantName ? (
              <p className="mt-1 truncate text-xs text-zinc-600 dark:text-white">{tenantName}</p>
            ) : null}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 md:hidden"
            aria-label="メニューを閉じる"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav
          ref={navRef}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 pb-8"
          aria-label="メインメニュー"
        >
        {showCheckSheetApproval && !showAdminSection ? (
          <>
            <SectionLabel variant="blue">⚙ 評価</SectionLabel>
            <NavLink
              href="/approval?tab=check"
              label="チェックシート評価"
              icon={ClipboardCheck}
              pathPrefixes={["/approval"]}
            />
          </>
        ) : null}
        {showAdminSection ? (
          <>
            <SectionLabel variant="blue">⚙ 管理</SectionLabel>
            <NavLink
              href="/"
              label="管理ダッシュボード"
              icon={LayoutDashboard}
              pathPrefixes={["/", "/dashboard"]}
            />
            <NavLink
              href="/approval"
              label="ワークフロー承認"
              icon={ClipboardCheck}
              pathPrefixes={["/approval"]}
              badgeCount={approvalBadgeCount > 0 ? approvalBadgeCount : undefined}
            />
            <NavLink
              href="/incentives"
              label="インセンティブ管理"
              icon={BarChart3}
              pathPrefixes={["/incentives"]}
              badgeCount={
                incentiveDraftBadgeCount > 0 ? incentiveDraftBadgeCount : undefined
              }
            />
            <NavLink
              href="/employees"
              label="従業員管理"
              icon={Users}
              pathPrefixes={["/employees"]}
            />
            <NavLink
              href="/expenses/audit"
              label="経費削減レポート"
              icon={FileSearch}
              pathPrefixes={["/expenses/audit"]}
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
            {showCompanyDocumentsAdminNav ? (
              <NavLink
                href="/settings/documents"
                label="就業規則管理"
                icon={ScrollText}
                pathPrefixes={["/settings/documents"]}
              />
            ) : null}
            <NavLink
              href="/settings/vehicles"
              label="車両管理"
              icon={Car}
              pathPrefixes={["/settings/vehicles"]}
            />
            <NavLink
              href="/settings"
              label="設定"
              icon={Settings}
              pathPrefixes={["/settings"]}
              excludePrefixes={[
                "/settings/auto-approval",
                "/settings/documents",
                "/settings/export",
                "/settings/tenant",
                "/settings/vehicles",
              ]}
            />
            <NavLink
              href="/settings/tenant"
              label="設定管理"
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

        <SectionLabel variant="emerald">👤 マイページ</SectionLabel>
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
        <NavLink href="/my/vehicles" label="社用車予約" icon={Car} pathPrefixes={["/my/vehicles"]} />
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
          href="/my/self-management"
          label="自己管理"
          icon={Target}
          pathPrefixes={["/my/self-management", "/my/goals", "/my/check-sheet", "/my/growth"]}
        />
        <NavLink
          href="/my/rules"
          label="就業規則・社内規定"
          icon={BookOpen}
          pathPrefixes={["/my/rules"]}
        />
        <NavLink
          href="/my/contract"
          label="雇用契約内容"
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
    </>
  );
}
