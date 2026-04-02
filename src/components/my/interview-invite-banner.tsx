"use client";

import { declineAiInterviewRequest } from "@/app/actions/ai-interview-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function InterviewInviteBanner({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/50 dark:bg-violet-950/40">
      <p className="font-semibold text-violet-900 dark:text-violet-100">
        ✦ AIとの面談のご案内
      </p>
      <p className="mt-2 text-sm text-violet-800 dark:text-violet-200">
        この面談の内容は外部には一切共有されません。安心してお話しください。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/hr-ai?mode=interview&request=${encodeURIComponent(requestId)}`}
          className="inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
        >
          AI面談を始める →
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await declineAiInterviewRequest(requestId);
              router.refresh();
            })
          }
          className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100 dark:hover:bg-violet-900/50"
        >
          後で
        </button>
      </div>
    </div>
  );
}
