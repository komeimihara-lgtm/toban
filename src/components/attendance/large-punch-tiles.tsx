"use client";

import { MoonStar, Sun } from "lucide-react";

type Props = {
  pending: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
};

/**
 * スマホ向けにタップ領域を大きくした出退勤タイル（2列グリッド）。
 * 背景はコントラスト重視（明るい面＋濃い文字）でダークテーマのカード上でも判読しやすくする。
 */
export function LargePunchActionTiles({
  pending,
  onClockIn,
  onClockOut,
}: Props) {
  const tileBase =
    "touch-manipulation select-none flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 text-center shadow-md transition hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50 sm:min-h-44 sm:gap-2.5 sm:py-6";

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
      <button
        type="button"
        disabled={pending}
        onClick={onClockIn}
        aria-label="出勤を打刻"
        className={`${tileBase} bg-zinc-200 text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200`}
      >
        <Sun
          className="size-12 shrink-0 sm:size-16"
          strokeWidth={1.65}
          aria-hidden
        />
        <span className="text-2xl font-bold tracking-tight sm:text-3xl">出勤</span>
        <span className="max-w-[11rem] text-[11px] font-normal leading-tight text-zinc-700 dark:text-zinc-800 sm:text-xs">
          今日もよろしくお願いします
        </span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onClockOut}
        aria-label="退勤を打刻"
        className={`${tileBase} bg-amber-400 text-amber-950 hover:bg-amber-300 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300`}
      >
        <MoonStar
          className="size-12 shrink-0 sm:size-16"
          strokeWidth={1.65}
          aria-hidden
        />
        <span className="text-2xl font-bold tracking-tight sm:text-3xl">退勤</span>
        <span className="max-w-[11rem] text-[11px] font-normal leading-tight text-amber-950/90 sm:text-xs">
          お疲れさまでした
        </span>
      </button>
    </div>
  );
}
