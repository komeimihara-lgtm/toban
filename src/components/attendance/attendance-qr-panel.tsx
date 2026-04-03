"use client";

import { generateAttendanceQrToken } from "@/app/actions/attendance-actions";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";

type PunchType = "clock_in" | "clock_out";

function buildPunchUrl(origin: string, type: PunchType, token: string) {
  const u = new URL("/api/attendance/qr-punch", origin);
  u.searchParams.set("type", type);
  u.searchParams.set("t", token);
  return u.toString();
}

export function AttendanceQrPanel() {
  const [origin, setOrigin] = useState("");
  const [inToken, setInToken] = useState<string | null>(null);
  const [outToken, setOutToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    const [a, b] = await Promise.all([
      generateAttendanceQrToken("clock_in"),
      generateAttendanceQrToken("clock_out"),
    ]);
    if (!a.ok || !b.ok) {
      setErr(!a.ok ? a.message : !b.ok ? b.message : "");
      setInToken(null);
      setOutToken(null);
      setExpiresAt(null);
      return;
    }
    setInToken(a.token);
    setOutToken(b.token);
    setExpiresAt(a.expiresAtIso);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 240_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!origin) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-card">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        QR 打刻（約5分で更新）
      </h2>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        本端末でログインした状態で QR を読み取ると打刻できます。QR
        の署名トークンには従業員ID（eid）・発行時刻（ts）・有効期限が含まれ、タブレット設置型の将来拡張に利用できます。
      </p>
      {err && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>
      )}
      {expiresAt && (
        <p className="mt-2 text-xs text-zinc-500">
          有効期限（目安）: {new Date(expiresAt).toLocaleString("ja-JP")}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-8">
        <div>
          <p className="mb-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
            出勤
          </p>
          {inToken ? (
            <QRCodeSVG
              value={buildPunchUrl(origin, "clock_in", inToken)}
              size={160}
              level="M"
              className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
            />
          ) : (
            <div className="flex size-[160px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-500">
              準備中…
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
            退勤
          </p>
          {outToken ? (
            <QRCodeSVG
              value={buildPunchUrl(origin, "clock_out", outToken)}
              size={160}
              level="M"
              className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
            />
          ) : (
            <div className="flex size-[160px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-500">
              準備中…
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void refresh()}
        className="mt-4 text-xs font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        QR を今すぐ更新
      </button>
    </section>
  );
}
