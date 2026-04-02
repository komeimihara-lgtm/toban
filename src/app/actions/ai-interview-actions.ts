"use server";

import { notifyLineUsers } from "@/lib/line";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function declineAiInterviewRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { error } = await supabase
    .from("ai_interview_requests")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("employee_id", user.id);

  if (error) return { ok: false as const };
  revalidatePath("/my");
  return { ok: true as const };
}

export async function acceptAiInterviewRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data: existing } = await supabase
    .from("ai_interview_requests")
    .select("status")
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .maybeSingle();

  const st = (existing as { status?: string } | null)?.status;
  if (!st || st === "declined" || st === "completed") {
    return { ok: false as const };
  }

  if (st === "pending") {
    const { error } = await supabase
      .from("ai_interview_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("employee_id", user.id)
      .eq("status", "pending");
    if (error) return { ok: false as const };
  }

  revalidatePath("/my");
  revalidatePath("/my/hr-ai");
  return { ok: true as const };
}

export async function completeAiInterview(requestId: string, summary: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, message: "ログインが必要です" };
  }

  const trimmed = summary.trim();
  if (!trimmed) {
    return { ok: false as const, message: "要約を入力してください" };
  }

  const { data: row } = await supabase
    .from("ai_interview_requests")
    .select("id, status, employee_id")
    .eq("id", requestId)
    .maybeSingle();

  const rec = row as { id: string; status: string; employee_id: string } | null;
  if (!rec || rec.employee_id !== user.id) {
    return { ok: false as const, message: "無効なリクエストです" };
  }
  if (rec.status === "completed" || rec.status === "declined") {
    return { ok: false as const, message: "すでに終了しています" };
  }

  const { error } = await supabase
    .from("ai_interview_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary: trimmed,
      risk_level: "low",
    })
    .eq("id", requestId)
    .eq("employee_id", user.id);

  if (error) {
    return { ok: false as const, message: "保存に失敗しました" };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    (prof as { full_name?: string | null } | null)?.full_name?.trim() ||
    user.email ||
    "従業員";

  await notifyLineUsers(
    `【LENARD HR】AI面談が完了しました\n${name} さん\n\n${trimmed.slice(0, 1200)}`,
  );

  revalidatePath("/my");
  revalidatePath("/my/hr-ai");
  return { ok: true as const };
}
