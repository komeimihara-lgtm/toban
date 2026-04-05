"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Timer, UserCircle } from "lucide-react";

const tabs = [
  { href: "/my", label: "ホーム", icon: Home, exact: true },
  { href: "/my/attendance", label: "勤怠", icon: Timer, exact: false },
  { href: "/my/profile", label: "プロフィール", icon: UserCircle, exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[var(--sidebar-border)] bg-[var(--background-sidebar)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
              active
                ? "text-accent"
                : "text-zinc-500 active:text-zinc-700 dark:text-zinc-400"
            }`}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
