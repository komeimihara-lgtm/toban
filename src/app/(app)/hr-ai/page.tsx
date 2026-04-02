import { Suspense } from "react";
import { HrAiClient } from "./hr-ai-client";

export const dynamic = "force-dynamic";

export default function HrAiPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}
    >
      <HrAiClient />
    </Suspense>
  );
}
