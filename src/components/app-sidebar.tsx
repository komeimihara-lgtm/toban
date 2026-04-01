"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Coins, Home } from "lucide-react";
import type { ComponentType } from "react";

type AppSidebarProps = {
  incentiveHref: "/my/incentive" | "/incentives";
  userLabel: string;
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
  /** 指定時はこれらのパス配下でもアクティブ（例: 勤怠と打刻修正） */
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

export function AppSidebar({ incentiveHref, userLabel }: AppSidebarProps) {
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
      <nav className="flex flex-col gap-0.5 p-3" aria-label="メインメニュー">
        <NavLink href="/" label="ホーム" icon={Home} />
        <NavLink
          href="/my/attendance"
          label="勤怠"
          icon={Clock}
          pathPrefixes={["/my/attendance", "/attendance"]}
        />
        <NavLink href={incentiveHref} label="インセンティブ" icon={Coins} />
      </nav>
    </aside>
  );
}
