import Link from "next/link";
import { FileEdit } from "lucide-react";

export const dynamic = "force-dynamic";

export default function MyAttendancePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          勤怠
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          打刻・休暇・勤務実績（主要機能は今後ここに集約されます）
        </p>
      </header>

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
