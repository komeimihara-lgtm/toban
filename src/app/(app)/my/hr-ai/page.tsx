import { normalizeHrConversationHistory } from "@/lib/hr-ai-messages";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HrAiClient } from "@/app/(app)/hr-ai/hr-ai-client";

export const dynamic = "force-dynamic";

export default async function MyHrAiPage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("hr_conversations")
    .select("id, messages")
    .eq("employee_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const convRow = conv as { id: string; messages: unknown } | null;
  const initialMessages = convRow
    ? normalizeHrConversationHistory(convRow.messages)
    : [];

  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}>
      <HrAiClient
        hrInitialConversationId={convRow?.id ?? null}
        hrInitialMessages={initialMessages}
      />
    </Suspense>
  );
}
