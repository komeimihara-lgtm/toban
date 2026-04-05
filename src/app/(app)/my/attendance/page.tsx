import { AttendancePunchPageClient } from "@/components/attendance/attendance-punch-page-client";
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

  /** GPS 列が未マイグレーションの DB でも打刻 UI を表示できるよう、失敗時は最小列で再試行 */
  let rows: {
    id: string;
    punch_type: string;
    punched_at: string;
    latitude: number | null;
    longitude: number | null;
  }[] = [];
  let punchFetchWarning: string | null = null;

  const fullSelect = await supabase
    .from("attendance_punches")
    .select("id, punch_type, punched_at, latitude, longitude")
    .eq("user_id", user.id)
    .gte("punched_at", monthStartIso)
    .lt("punched_at", monthEndIso)
    .order("punched_at", { ascending: true });

  if (!fullSelect.error && fullSelect.data) {
    rows = fullSelect.data as typeof rows;
  } else {
    const minimal = await supabase
      .from("attendance_punches")
      .select("id, punch_type, punched_at")
      .eq("user_id", user.id)
      .gte("punched_at", monthStartIso)
      .lt("punched_at", monthEndIso)
      .order("punched_at", { ascending: true });

    if (!minimal.error && minimal.data) {
      rows = (minimal.data as { id: string; punch_type: string; punched_at: string }[]).map(
        (r) => ({ ...r, latitude: null, longitude: null }),
      );
      punchFetchWarning =
        "位置情報列（緯度・経度）が未適用のため、履歴は表示されますが地図連携はありません。マイグレーション 006_attendance_punch_extend を適用してください。";
    } else {
      punchFetchWarning =
        "打刻履歴をデータベースから読み込めませんでした。この画面からの新規打刻はお試しください。解消しない場合は Supabase の attendance_punches テーブルと RLS を確認してください。";
    }
  }
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const todayPunches = rows.filter((r) => jstDateKey(r.punched_at) === todayKey);
  const summary = summarizePunchesInRange(rows, { now });

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-foreground">
      {punchFetchWarning ? (
        <div
          className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {punchFetchWarning}
        </div>
      ) : null}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">勤怠</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/my/attendance/correction"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            <FileEdit className="size-4 shrink-0" aria-hidden />
            修正申請
          </Link>
          <Link
            href={`/my/attendance/calendar?y=${y}&m=${m}`}
            className="inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
          >
            月次カレンダー
          </Link>
        </div>
      </header>

      {flashOk && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.punched === "clock_in" ? "出勤" : "退勤"}
          を記録しました。
        </p>
      )}
      {flashErr && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {flashErr}
        </p>
      )}

      <AttendancePunchPageClient
        todayPunches={todayPunches as never}
        workDays={summary.workDays}
        totalWorkMinutes={summary.totalWorkMinutes}
        overtimeMinutes={summary.overtimeMinutes}
      />

    </div>
  );
}
