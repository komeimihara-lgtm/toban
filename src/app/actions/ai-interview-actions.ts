"use server";

import { getAuthUserEmail } from "@/lib/auth-user-email";
import {
  sendAiInterviewCompletedAdminEmail,
  sendAiInterviewInviteEmail,
} from "@/lib/email";
import { pushLineMessage, notifyLineUsers } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { revalidatePath } from "next/cache";

async function notifyAdminsInterviewCompletedLine(employeeName: string) {
  const text = `【LENARD HR】AI面談が完了しました\n${employeeName} さんのセッションが終了しました。\n会話の具体的内容は開示されていません。`;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await notifyLineUsers(text);
    return;
  }
  const { data: owners } = await admin
    .from("profiles")
    .select("line_user_id")
    .eq("role", "owner")
    .not("line_user_id", "is", null);
  for (const o of owners ?? []) {
    const id = (o as { line_user_id: string }).line_user_id?.trim();
    if (id) await pushLineMessage(id, text);
  }
  await notifyLineUsers(text);
}

async function notifyAdminsInterviewCompletedEmail(
  admin: ReturnType<typeof createAdminClient>,
  employeeName: string,
) {
  const { data: owners } = await admin.from("profiles").select("id").eq("role", "owner");
  for (const o of owners ?? []) {
    const oid = (o as { id: string }).id;
    const email = await getAuthUserEmail(admin, oid);
    if (email) await sendAiInterviewCompletedAdminEmail(email, employeeName);
  }
}

export async function recommendAiInterviewFromRetentionAction(
  formData: FormData,
): Promise<void> {
  const employeeId = formData.get("employee_id")?.toString().trim();
  const alertIdRaw = formData.get("alert_id")?.toString().trim();
  const companyId = formData.get("company_id")?.toString().trim();
  if (!employeeId || !companyId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isAdminRole((me as { role?: string })?.role ?? "")) return;

  const { data: pending } = await supabase
    .from("ai_interview_requests")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return;

  const { error } = await supabase.from("ai_interview_requests").insert({
    company_id: companyId,
    employee_id: employeeId,
    requested_by: user.id,
    alert_id: alertIdRaw || null,
    status: "pending",
  });
  if (error) {
    console.error("[ai-interview] insert:", error.message);
    return;
  }

  const { data: empProf } = await supabase
    .from("profiles")
    .select("full_name, line_user_id")
    .eq("id", employeeId)
    .maybeSingle();
  const empName =
    (empProf as { full_name?: string | null } | null)?.full_name?.trim() ?? "従業員";
  const lineUid = (empProf as { line_user_id?: string | null } | null)?.line_user_id?.trim();

  if (lineUid) {
    await pushLineMessage(
      lineUid,
      `【LENARD HR】上司からAI面談のご案内です。\nマイページ上部のバナーから「AI面談を始める」をタップしてください。`,
    );
  }

  try {
    const admin = createAdminClient();
    const email = await getAuthUserEmail(admin, employeeId);
    if (email) await sendAiInterviewInviteEmail(email, empName);
  } catch {
    /* SERVICE_ROLE なし時はメールスキップ */
  }

  revalidatePath("/dashboard");
  revalidatePath("/my");
}

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

/** 面談終了。会話内容は管理者に開示しない。 */
export async function completeAiInterview(requestId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const { data: row } = await supabase
    .from("ai_interview_requests")
    .select("id, status, employee_id")
    .eq("id", requestId)
    .maybeSingle();

  const rec = row as { id: string; status: string; employee_id: string } | null;
  if (!rec || rec.employee_id !== user.id) {
    return { ok: false, message: "無効なリクエストです" };
  }
  if (rec.status === "completed" || rec.status === "declined") {
    return { ok: false, message: "すでに終了しています" };
  }

  const { error } = await supabase
    .from("ai_interview_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      summary: null,
      risk_level: null,
    })
    .eq("id", requestId)
    .eq("employee_id", user.id);

  if (error) {
    return { ok: false, message: "保存に失敗しました" };
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

  await notifyAdminsInterviewCompletedLine(name);

  try {
    const admin = createAdminClient();
    await notifyAdminsInterviewCompletedEmail(admin, name);
  } catch {
    /* メールはベストエフォート */
  }

  revalidatePath("/my");
  revalidatePath("/my/hr-ai");
  return { ok: true };
}
