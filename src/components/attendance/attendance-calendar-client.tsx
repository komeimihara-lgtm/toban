"use client";

import type { CalendarCell } from "@/lib/attendance-calendar-build";
import { formatHoursMinutes } from "@/lib/attendance-summary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const KIND_CLASS: Record<CalendarCell["kind"], string> = {
  empty: "bg-transparent",
  weekend: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400",
  work: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
  leave_full: "bg-sky-200 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100",
  leave_half: "bg-sky-100 text-sky-900 dark:bg-sky-950/35 dark:text-sky-100",
  neutral: "bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
};

export function AttendanceCalendarClient({
  year,
  month,
  cells,
  workDays,
  totalWorkMinutes,
  paidLeaveDays,
}: {
  year: number;
  month: number;
  cells: CalendarCell[];
  workDays: number;
  totalWorkMinutes: number;
  paidLeaveDays: number;
}) {
  const router = useRouter();

  function go(delta: number) {
    let y = year;
    let m = month + delta;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    router.push(`/my/attendance/calendar?y=${y}&m=${m}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            勤怠カレンダー
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            出勤・有給（承認済）・休日を色分けしています。
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-600"
            aria-label="前月"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-semibold tabular-nums">
            {year}年{month}月
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-600"
            aria-label="次月"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <section className="flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-emerald-200 dark:bg-emerald-900/50" />
          出勤（打刻あり）
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-sky-200 dark:bg-sky-900/50" />
          有給（全日）
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-sky-100 dark:bg-sky-950/35" />
          有給（半休・時間）
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-zinc-200 dark:bg-zinc-700" />
          土日
        </span>
      </section>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`min-h-[3.25rem]
              rounded-lg border border-zinc-100 p-2 dark:border-zinc-800/80 ${KIND_CLASS[c.kind]}`}
          >
            {c.dayNum != null ? (
              <span className="tabular-nums font-semibold">{c.dayNum}</span>
            ) : null}
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">月間サマリー</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">出勤日数</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{workDays} 日</dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">総労働時間</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatHoursMinutes(totalWorkMinutes)}
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">有給取得日数（換算）</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
              {paidLeaveDays} 日
            </dd>
          </div>
        </dl>
        <Link
          href="/my/leave"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          有給申請（マイページ）
        </Link>
        <p className="mt-2 text-xs text-zinc-500">
          承認済みの休暇申請のみカレンダーに反映されます。
        </p>
      </section>
    </div>
  );
}
