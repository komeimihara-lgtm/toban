"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "lenard-hr-shift-week-v1";

export type ShiftCellType = "day" | "night" | "half" | "off";

const SHIFT_LABEL: Record<ShiftCellType, string> = {
  day: "日勤",
  night: "夜勤",
  half: "半休",
  off: "休み",
};

const SHIFT_CLASS: Record<ShiftCellType, string> = {
  day: "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100",
  night: "bg-indigo-100 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100",
  half: "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
  off: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400",
};

const HOURS: Record<ShiftCellType, number> = {
  day: 8,
  night: 8,
  half: 4,
  off: 0,
};

type Staff = { id: string; name: string };

const MOCK_STAFF: Staff[] = [
  { id: "st-1", name: "高橋" },
  { id: "st-2", name: "田村" },
  { id: "st-3", name: "橋本" },
  { id: "st-4", name: "中村" },
  { id: "st-5", name: "川津" },
  { id: "st-6", name: "小山" },
];

type GridState = Record<string, Record<number, ShiftCellType>>;

function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function weekKey(weekStart: Date): string {
  return weekStart.toISOString().slice(0, 10);
}

function loadGrid(weekStart: Date): GridState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, GridState>;
    return all[weekKey(weekStart)] ?? {};
  } catch {
    return {};
  }
}

function saveGrid(weekStart: Date, grid: GridState) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, GridState>) : {};
    all[weekKey(weekStart)] = grid;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function ShiftWeekClient() {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [grid, setGrid] = useState<GridState>({});
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<{
    staffId: string;
    dayIndex: number;
    current: ShiftCellType;
  } | null>(null);

  useEffect(() => {
    setGrid(loadGrid(weekStart));
    setHydrated(true);
  }, [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const setCell = useCallback(
    (staffId: string, dayIndex: number, value: ShiftCellType) => {
      setGrid((prev) => {
        const next = {
          ...prev,
          [staffId]: { ...prev[staffId], [dayIndex]: value },
        };
        saveGrid(weekStart, next);
        return next;
      });
    },
    [weekStart],
  );

  const summary = useMemo(() => {
    let totalHours = 0;
    const perDayWorking = Array(7).fill(0) as number[];
    for (const s of MOCK_STAFF) {
      for (let di = 0; di < 7; di++) {
        const t = grid[s.id]?.[di] ?? "off";
        totalHours += HOURS[t];
        if (t !== "off") perDayWorking[di] += 1;
      }
    }
    return { totalHours, perDayWorking };
  }, [grid]);

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            シフト管理
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            週次グリッド（ブラウザにドラフト保存）。本番では DB 連携を想定しています。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            前週
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOfWeek(new Date()))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            今週
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            次週
          </button>
        </div>
      </header>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="sticky left-0 z-10 min-w-[5.5rem] border-r border-zinc-200 bg-zinc-50 px-2 py-3 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900/50">
                スタッフ
              </th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className="px-1 py-3 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                >
                  <div>
                    {d.toLocaleDateString("ja-JP", {
                      weekday: "short",
                      month: "numeric",
                      day: "numeric",
                    })}
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                    出勤 {summary.perDayWorking[i]}人
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_STAFF.map((s) => (
              <tr
                key={s.id}
                className="border-b border-zinc-100 dark:border-zinc-800/80"
              >
                <td className="sticky left-0 z-10 border-r border-zinc-100 bg-white px-2 py-2 font-medium dark:border-zinc-800 dark:bg-zinc-950">
                  {s.name}
                </td>
                {days.map((_, di) => {
                  const t = grid[s.id]?.[di] ?? "off";
                  return (
                    <td key={di} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            staffId: s.id,
                            dayIndex: di,
                            current: t,
                          })
                        }
                        className={`w-full rounded-md px-1 py-2 text-xs font-medium transition hover:ring-2 hover:ring-emerald-400/50 ${SHIFT_CLASS[t]}`}
                      >
                        {SHIFT_LABEL[t]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">今週の集計</h2>
        <dl className="mt-3 flex flex-wrap gap-6">
          <div>
            <dt className="text-xs text-zinc-500">総シフト時間（目安）</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.totalHours} 時間
            </dd>
            <p className="text-xs text-zinc-500">
              日勤・夜勤 8h、半休 4h で換算
            </p>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">7 日間の出勤予定（延べ人数）</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.perDayWorking.reduce((a, b) => a + b, 0)} 人日
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setModal({
              staffId: MOCK_STAFF[0].id,
              dayIndex: 0,
              current: grid[MOCK_STAFF[0].id]?.[0] ?? "off",
            })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="size-4" aria-hidden />
          シフトを追加・変更
        </button>
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="shift-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <h2 id="shift-modal-title" className="text-base font-semibold">
              シフトを選択
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {MOCK_STAFF.find((x) => x.id === modal.staffId)?.name} ·{" "}
              {days[modal.dayIndex].toLocaleDateString("ja-JP", {
                weekday: "long",
                month: "numeric",
                day: "numeric",
              })}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(Object.keys(SHIFT_LABEL) as ShiftCellType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setCell(modal.staffId, modal.dayIndex, t);
                    setModal(null);
                  }}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${SHIFT_CLASS[t]}`}
                >
                  {SHIFT_LABEL[t]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-zinc-300 py-2 text-sm dark:border-zinc-600"
              onClick={() => setModal(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
