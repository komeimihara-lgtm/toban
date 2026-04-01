import { CorrectionRequestForm } from "@/components/attendance/correction-request-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AttendanceCorrectionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/my/attendance"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" aria-hidden />
          勤怠に戻る
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          打刻修正申請
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          内容を入力し、申請してください。承認フローは本番環境で接続します。
        </p>
      </header>

      <CorrectionRequestForm />
    </div>
  );
}
