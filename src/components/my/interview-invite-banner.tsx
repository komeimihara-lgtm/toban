"use client";

import { declineAiInterviewRequest } from "@/app/actions/ai-interview-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const storageKey = (requestId: string) =>
  `lenard_hr_ai_interview_banner_hide_${requestId}`;

export function InterviewInviteBanner({ requestId }: { requestId: string }) {
  const [hidden, setHidden] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setHidden(localStorage.getItem(storageKey(requestId)) === "1");
      } catch {
        setHidden(false);
      }
    });
  }, [requestId]);

  if (hidden) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/35">
      <p className="font-semibold text-amber-950 dark:text-amber-100">
        上司からAI面談のご案内が届いています
      </p>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
        いつでも話を聞きます。内容が上司に具体的に伝わることはありません。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/hr-ai?interview_mode=true&request=${encodeURIComponent(requestId)}`}
          className="inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          AI面談を始める →
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            try {
              localStorage.setItem(storageKey(requestId), "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
            router.refresh();
          }}
          className="rounded-lg border border-amber-600/40 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-card dark:text-amber-100 dark:hover:bg-zinc-800"
        >
          後で
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await declineAiInterviewRequest(requestId);
              router.refresh();
            })
          }
          className="rounded-lg px-3 py-2 text-xs text-amber-800 underline dark:text-amber-200"
        >
          今回は辞退する
        </button>
      </div>
    </div>
  );
}
