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
    "touch-manipulation select-none flex h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl px-4 py-6 text-center shadow-md transition hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="grid w-full grid-cols-2 gap-4">
      <button
        type="button"
        disabled={pending}
        onClick={onClockIn}
        aria-label="出勤を打刻"
        className={`${tileBase} bg-gray-100 text-zinc-900 hover:bg-gray-50 dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200`}
      >
        <Sun
          className="h-16 w-16 shrink-0"
          strokeWidth={1.65}
          aria-hidden
        />
        <span className="text-2xl font-bold tracking-tight">出勤</span>
        <span className="text-sm font-normal text-zinc-700 dark:text-zinc-800">
          今日もよろしくお願いします
        </span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onClockOut}
        aria-label="退勤を打刻"
        className={`${tileBase} bg-yellow-400 text-amber-950 hover:bg-yellow-300 dark:bg-yellow-400 dark:text-amber-950 dark:hover:bg-yellow-300`}
      >
        <MoonStar
          className="h-16 w-16 shrink-0"
          strokeWidth={1.65}
          aria-hidden
        />
        <span className="text-2xl font-bold tracking-tight">退勤</span>
        <span className="text-sm font-normal text-amber-950/90">
          お疲れさまでした
        </span>
      </button>
    </div>
  );
}
