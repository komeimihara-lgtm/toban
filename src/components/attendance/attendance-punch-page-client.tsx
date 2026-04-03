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
import { LargePunchActionTiles } from "@/components/attendance/large-punch-tiles";
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
  const [geoAddress, setGeoAddress] = useState<string | null>(null);
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
          fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=ja`,
          )
            .then((r) => r.json())
            .then((data) => {
              const city =
                data.city || data.locality || data.principalSubdivision || "";
              if (city) setGeoAddress(city);
            })
            .catch(() => {
              /* ignore */
            });
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

  const geoLine = geoAddress ?? geoStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-zinc-500">📍 {geoLine}</p>
          <p className="shrink-0 text-xl font-bold tabular-nums text-zinc-50">
            {now.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Tokyo",
            })}
          </p>
        </div>
        <LargePunchActionTiles
          pending={pending}
          onClockIn={() => onPunch("clock_in")}
          onClockOut={() => onPunch("clock_out")}
        />
      </div>

      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-semibold text-zinc-50">本日のタイムライン</h2>
        <ul className="mt-3 space-y-2">
          {timelineRows.length === 0 ? (
            <li className="text-sm text-zinc-500">本日の打刻はまだありません</li>
          ) : (
            timelineRows.map((row) =>
              row.kind === "auto_break" ? (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 pb-2 text-sm last:border-0"
                >
                  <span className="font-medium text-sky-300">
                    休憩（自動）{row.minutes}分
                  </span>
                  <span className="text-xs text-zinc-500">労基法準拠の控除</span>
                </li>
              ) : (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 pb-2 text-sm last:border-0"
                >
                  <span className="font-medium text-zinc-200">
                    {punchTypeLabel(row.punchType)}
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-zinc-400">
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

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-semibold text-zinc-50">今月の勤務サマリー</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-900/80 p-3">
            <dt className="text-xs text-zinc-500">出勤日数</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
              {workDays} 日
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-900/80 p-3">
            <dt className="text-xs text-zinc-500">総労働時間</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
              {formatHoursMinutes(totalWorkMinutes)}
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-900/80 p-3">
            <dt className="text-xs text-zinc-500">残業時間（概算）</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-400">
              {formatHoursMinutes(overtimeMinutes)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
