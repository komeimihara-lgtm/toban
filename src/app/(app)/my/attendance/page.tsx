import { AttendancePunchPageClient } from "@/components/attendance/attendance-punch-page-client";
import { AttendanceQrPanel } from "@/components/attendance/attendance-qr-panel";
import {
  jstDateKey,
  summarizePunchesInRange,
} from "@/lib/attendance-summary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { FileEdit } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ punched?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const flashOk = sp.punched === "clock_in" || sp.punched === "clock_out";
  const errLabel: Record<string, string> = {
    token: "QRの有効期限が切れたか、無効なリンクです。QRを更新して再度お試しください。",
    mismatch: "打種が一致しません。",
    type: "打刻種別が不正です。",
    config: "サーバー設定エラーです。",
    db: "打刻の保存に失敗しました。",
  };
  const flashErr = sp.error ? errLabel[sp.error] ?? "エラーが発生しました。" : null;

  if (!isSupabaseConfigured()) return <p>Supabase 未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const monthStartIso = `${y}-${pad(m)}-01T00:00:00+09:00`;
  const monthEndIso = `${nextY}-${pad(nextM)}-01T00:00:00+09:00`;

  const { data: monthRows, error } = await supabase
    .from("attendance_punches")
    .select("id, punch_type, punched_at, latitude, longitude")
    .eq("user_id", user.id)
    .gte("punched_at", monthStartIso)
    .lt("punched_at", monthEndIso)
    .order("punched_at", { ascending: true });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        打刻データの取得に失敗しました。マイグレーション（006_attendance_punch_extend 等）を確認してください。
      </p>
    );
  }

  const rows = monthRows ?? [];
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const todayPunches = rows.filter((r) => jstDateKey(r.punched_at) === todayKey);
  const summary = summarizePunchesInRange(rows, { now });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            勤怠
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            打刻・月次カレンダー・打刻修正の申請
          </p>
        </div>
        <Link
          href={`/my/attendance/calendar?y=${y}&m=${m}`}
          className="text-sm font-medium text-blue-600 underline dark:text-blue-400"
        >
          月次カレンダー →
        </Link>
      </header>

      {flashOk && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {sp.punched === "clock_in" ? "出勤" : "退勤"}
          を記録しました。
        </p>
      )}
      {flashErr && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {flashErr}
        </p>
      )}

      <AttendancePunchPageClient
        todayPunches={todayPunches as never}
        workDays={summary.workDays}
        totalWorkMinutes={summary.totalWorkMinutes}
        overtimeMinutes={summary.overtimeMinutes}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          QR 打刻（別端末）
        </h2>
        <div className="mt-4">
          <AttendanceQrPanel />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          打刻修正申請
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          打刻漏れ・誤打刻がある場合はフォームから申請してください。
        </p>
        <div className="mt-5">
          <Link
            href="/attendance/correction"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <FileEdit className="size-4" aria-hidden />
            打刻修正申請へ
          </Link>
        </div>
      </section>
    </div>
  );
}
