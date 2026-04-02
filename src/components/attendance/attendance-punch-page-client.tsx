"use client";

import {
  punchAttendance,
  type PunchGeo,
} from "@/app/actions/attendance-actions";
import { calcBreakTime } from "@/lib/attendance-storage";
import {
  formatHoursMinutes,
  punchTypeLabel,
} from "@/lib/attendance-summary";
import type { AttendancePunchType } from "@/types";
import { MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type PunchRow = {
  id: string;
  punch_type: string;
  punched_at: string;
  latitude: number | null;
  longitude: number | null;
};

type TimelineRow =
  | {
      kind: "punch";
      id: string;
      punchType: string;
      punchedAt: string;
    }
  | {
      kind: "auto_break";
      id: string;
      minutes: number;
    };

export function AttendancePunchPageClient({
  todayPunches,
  workDays,
  totalWorkMinutes,
  overtimeMinutes,
}: {
  todayPunches: PunchRow[];
  workDays: number;
  totalWorkMinutes: number;
  overtimeMinutes: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("未取得");
  const [lastGeo, setLastGeo] = useState<PunchGeo | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const requestGeo = useCallback((): Promise<PunchGeo | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoStatus("この環境では位置情報を利用できません");
        resolve(null);
        return;
      }
      setGeoStatus("位置を取得中…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const g: PunchGeo = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
          };
          setLastGeo(g);
          setGeoStatus(
            `取得済（±${Math.round(pos.coords.accuracy ?? 0)}m 付近）`,
          );
          resolve(g);
        },
        () => {
          setGeoStatus("位置情報が利用できませんでした（打刻のみ実行できます）");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  }, []);

  const onPunch = (type: AttendancePunchType) => {
    setMsg(null);
    start(async () => {
      const g = await requestGeo();
      const r = await punchAttendance(type, g);
      if (!r.ok) {
        setMsg(r.message ?? "エラー");
        return;
      }
      setMsg("打刻しました。");
      router.refresh();
    });
  };

  const previewCoords =
    lastGeo != null
      ? `${lastGeo.latitude.toFixed(5)}, ${lastGeo.longitude.toFixed(5)}`
      : "—";

  const timelineRows = useMemo((): TimelineRow[] => {
    const clockOnly = todayPunches.filter(
      (p) => p.punch_type === "clock_in" || p.punch_type === "clock_out",
    );
    const sorted = [...clockOnly].sort(
      (a, b) =>
        new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    const firstIn = sorted.find((p) => p.punch_type === "clock_in");
    const lastOut = [...sorted].reverse().find((p) => p.punch_type === "clock_out");
    const endMs = lastOut
      ? new Date(lastOut.punched_at).getTime()
      : now.getTime();
    const gross =
      firstIn != null
        ? Math.max(
            0,
            Math.round((endMs - new Date(firstIn.punched_at).getTime()) / 60_000),
          )
        : 0;
    const autoMins = firstIn != null ? calcBreakTime(gross) : 0;

    const out: TimelineRow[] = [];
    let insertedAuto = false;
    for (const p of sorted) {
      out.push({
        kind: "punch",
        id: p.id,
        punchType: p.punch_type,
        punchedAt: p.punched_at,
      });
      if (!insertedAuto && autoMins > 0 && firstIn && p.id === firstIn.id) {
        out.push({
          kind: "auto_break",
          id: `auto-break-${firstIn.id}`,
          minutes: autoMins,
        });
        insertedAuto = true;
      }
    }
    return out;
  }, [todayPunches, now]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            勤怠打刻
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            打刻時に位置情報を取得します（拒否した場合も打刻は可能です）。
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right tabular-nums dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500">現在時刻（ブラウザ）</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {now.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {now.toLocaleDateString("ja-JP", {
              timeZone: "Asia/Tokyo",
              weekday: "short",
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          打刻
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onPunch("clock_in")}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            出勤
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPunch("clock_out")}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-600"
          >
            退勤
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
          <p className="font-medium">自動休憩控除（労基法準拠の目安）</p>
          <p className="mt-2 text-xs leading-relaxed opacity-95">
            実労働時間は「退勤 − 出勤」から、労働時間に応じて次の休憩分を自動で差し引きます。
          </p>
          <ul className="mt-2 list-inside list-disc text-xs leading-relaxed opacity-95">
            <li>6時間以下: 休憩控除なし</li>
            <li>6〜8時間: 45分控除</li>
            <li>8時間超: 60分控除</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-4 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
          <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              GPS（Geolocation API）
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{geoStatus}</p>
            <p className="font-mono text-xs text-zinc-500">直近: {previewCoords}</p>
            <button
              type="button"
              onClick={() => void requestGeo()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <RefreshCw className="size-3" aria-hidden />
              位置だけ取得（テスト）
            </button>
          </div>
        </div>

        {msg ? (
          <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">{msg}</p>
        ) : null}

        <p className="mt-4 text-xs text-zinc-500">
          <Link
            href="/my/attendance/correction"
            className="font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            打刻修正申請
          </Link>
          ・
          <Link href="/my/attendance/calendar" className="underline">
            月次カレンダー
          </Link>
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">本日のタイムライン</h2>
        <p className="mt-1 text-xs text-zinc-500">
          休憩は出退勤の間の実時間に応じて自動計上します（手動の休憩打刻はありません）。
        </p>
        <ul className="mt-3 space-y-2">
          {timelineRows.length === 0 ? (
            <li className="text-sm text-zinc-500">本日の打刻はまだありません</li>
          ) : (
            timelineRows.map((row) =>
              row.kind === "auto_break" ? (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800"
                >
                  <span className="font-medium text-sky-800 dark:text-sky-300">
                    休憩（自動）{row.minutes}分
                  </span>
                  <span className="text-xs text-zinc-500">労基法準拠の控除</span>
                </li>
              ) : (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800"
                >
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {punchTypeLabel(row.punchType)}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    {new Date(row.punchedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </li>
              ),
            )
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">今月の勤務サマリー</h2>
        <p className="mt-1 text-xs text-zinc-500">
          所定 8 時間/日を超えた分を残業として集計しています。総労働時間には上記の自動休憩控除後の実労働時間を用いています。
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">出勤日数</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{workDays} 日</dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">総労働時間（自動休憩控除後）</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatHoursMinutes(totalWorkMinutes)}
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <dt className="text-xs text-zinc-500">残業時間（概算）</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-800 dark:text-amber-300">
              {formatHoursMinutes(overtimeMinutes)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
