import { AttendanceQrPanel } from "@/components/attendance/attendance-qr-panel";
import { PunchButtons } from "@/components/attendance/punch-buttons";
import { FileEdit } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          勤怠
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Web 打刻・QR 打刻・修正申請
        </p>
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

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Web 打刻
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          この端末から直接出勤・退勤を記録します。
        </p>
        <div className="mt-4">
          <PunchButtons />
        </div>
      </section>

      <AttendanceQrPanel />

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          申請・修正
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          打刻漏れ・誤打刻がある場合は、修正申請フォームから申請してください。
        </p>
        <div className="mt-5">
          <Link
            href="/attendance/correction"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <FileEdit className="size-4" aria-hidden />
            打刻修正申請
          </Link>
        </div>
      </section>
    </div>
  );
}
