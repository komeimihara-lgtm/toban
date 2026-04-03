"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer, Camera, CalendarDays, MessageCircle, Menu } from "lucide-react";

const tabs = [
  { href: "/my/attendance", label: "打刻", icon: Timer },
  { href: "/my/expenses", label: "経費", icon: Camera },
  { href: "/my/leave", label: "有給", icon: CalendarDays },
  { href: "/hr-ai", label: "AI相談", icon: MessageCircle },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[var(--sidebar-border)] bg-[var(--background-sidebar)] md:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-menu"))}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-zinc-500 transition-colors active:text-zinc-700 dark:text-zinc-400"
      >
        <Menu className="size-5" />
        <span className="text-[10px] font-medium">メニュー</span>
      </button>
    </nav>
  );
}
