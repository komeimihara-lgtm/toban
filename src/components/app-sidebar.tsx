"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Home,
  LayoutDashboard,
  Settings,
  Timer,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

export type AppSidebarProps = {
  userLabel: string;
  tenantName?: string | null;
  showAdminSection: boolean;
};

function NavLink({
  href,
  label,
  icon: Icon,
  pathPrefixes,
  excludePrefixes,
  exact = false,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathPrefixes?: string[];
  excludePrefixes?: string[];
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
    </Link>
  );
}

function SectionLabel({
  children,
  variant = "blue",
}: {
  children: ReactNode;
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
    </p>
  );
}

export function AppSidebar({
  userLabel,
  tenantName,
  showAdminSection,
}: AppSidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-mobile-menu", handler);
    return () => window.removeEventListener("open-mobile-menu", handler);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const save = () => sessionStorage.setItem("sb-scroll", String(el.scrollTop));
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem("sb-scroll");
    if (!saved) return;
    const t1 = setTimeout(() => { el.scrollTop = Number(saved); }, 0);
    const t2 = setTimeout(() => { el.scrollTop = Number(saved); }, 50);
    const t3 = setTimeout(() => { el.scrollTop = Number(saved); }, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pathname]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`no-print flex h-screen w-56 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--background-sidebar)]
          max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:shadow-xl
          max-md:transition-transform max-md:duration-300 max-md:ease-in-out
          ${mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}
        `}
      >
        <div className="flex items-start justify-between border-b border-[var(--sidebar-border)] px-4 py-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40">
                <span className="text-lg font-black text-white">T</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-widest text-zinc-900 dark:text-white">
                  TOBAN
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                  お店とバイトをつなぐ、当番管理アプリ
                </p>
              </div>
            </div>
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
              {userLabel}
            </p>
            {tenantName ? (
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                {tenantName}
              </p>
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
        {showAdminSection ? (
          <>
            <SectionLabel variant="blue">⚙ 管理</SectionLabel>
            <NavLink
              href="/"
              label="ダッシュボード"
              icon={LayoutDashboard}
              pathPrefixes={["/", "/dashboard"]}
            />
            <NavLink
              href="/employees"
              label="スタッフ管理"
              icon={Users}
              pathPrefixes={["/employees"]}
            />
            <NavLink
              href="/settings"
              label="設定"
              icon={Settings}
              pathPrefixes={["/settings"]}
              excludePrefixes={["/settings/tenant"]}
            />
            <NavLink
              href="/settings/tenant"
              label="店舗設定"
              icon={Building2}
              pathPrefixes={["/settings/tenant"]}
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
          href="/my/profile"
          label="プロフィール"
          icon={UserCircle}
          pathPrefixes={["/my/profile"]}
        />
      </nav>
    </aside>
    </>
  );
}
