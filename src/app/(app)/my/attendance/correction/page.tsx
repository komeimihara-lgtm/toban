import { AttendanceCorrectionClient } from "@/components/attendance/attendance-correction-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function MyAttendanceCorrectionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/my/attendance"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          勤怠に戻る
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">
          打刻修正申請
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          対象日の元打刻を確認し、修正内容と理由を入力して申請します。承認後に LINE
          / メールで結果をお知らせします（会社の通知設定に従います）。
        </p>
      </header>

      <AttendanceCorrectionClient />
    </div>
  );
}
