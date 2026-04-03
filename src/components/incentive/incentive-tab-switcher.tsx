"use client";

import Link from "next/link";

export function IncentiveTabSwitcher({ activeTab }: { activeTab: string }) {
  const tabs = [
    { key: "deals", label: "計算・提出", href: "/incentives" },
    { key: "history", label: "支給履歴", href: "/incentives?tab=history" },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === t.key
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
