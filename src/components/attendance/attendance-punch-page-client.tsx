"use client";

import {
  punchAttendance,
  type PunchGeo,
} from "@/app/actions/attendance-actions";
import type { AttendancePunchType } from "@/types";
import {
  formatHoursMinutes,
  punchTypeLabel,
} from "@/lib/attendance-summary";
import { MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

type PunchRow = {
  id: string;
  punch_type: string;
  punched_at: string;
  latitude: number | null;
  longitude: number | null;
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
          <button
            type="button"
            disabled={pending}
            onClick={() => onPunch("break_start")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
          >
            休憩入り
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPunch("break_end")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
          >
            休憩戻り
          </button>
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
        <ul className="mt-3 space-y-2">
          {todayPunches.length === 0 ? (
            <li className="text-sm text-zinc-500">本日の打刻はまだありません</li>
          ) : (
            [...todayPunches]
              .sort(
                (a, b) =>
                  new Date(a.punched_at).getTime() -
                  new Date(b.punched_at).getTime(),
              )
              .map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800"
                >
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {punchTypeLabel(p.punch_type)}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    {new Date(p.punched_at).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </li>
              ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">今月の勤務サマリー</h2>
        <p className="mt-1 text-xs text-zinc-500">
          所定 8 時間/日を超えた分を残業として集計しています。休憩入り／戻りがある場合は休憩時間を差し引きます。
        </p>
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
