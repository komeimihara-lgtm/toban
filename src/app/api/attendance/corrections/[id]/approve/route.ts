import {
  getProfile,
  getSessionUser,
  isOwnerOrApprover,
} from "@/lib/api-auth";
import {
  normalizeCompanySettings,
  usesEmailChannel,
  usesLineChannel,
} from "@/lib/company-settings";
import { buildAttendanceCorrectionMail } from "@/lib/email";
import { getAuthUserEmail } from "@/lib/auth-user-email";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  if (!isOwnerOrApprover(profile.role)) {
    return NextResponse.json({ error: "承認権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as {
    action?: string;
    reason?: string | null;
  };
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action は approve または reject" },
      { status: 400 },
    );
  }

  const { data: row, error: fe } = await supabase
    .from("attendance_corrections")
    .select("*")
    .eq("id", id)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }

  const corr = row as {
    id: string;
    company_id: string;
    employee_id: string;
    target_date: string;
    status: string;
  };

  if (corr.company_id !== profile.company_id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (corr.status !== "pending") {
    return NextResponse.json({ error: "未処理の申請ではありません" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rejectionReason =
    action === "reject" ? String(body.reason ?? "").trim() : "";

  if (action === "reject" && !rejectionReason) {
    return NextResponse.json({ error: "差戻し理由は必須です" }, { status: 400 });
  }

  const patch =
    action === "approve"
      ? {
          status: "approved" as const,
          approved_by: user.id,
          approved_at: now,
          rejection_reason: null as string | null,
          updated_at: now,
        }
      : {
          status: "rejected" as const,
          approved_by: user.id,
          approved_at: now,
          rejection_reason: rejectionReason,
          updated_at: now,
        };

  const { error: upErr } = await supabase
    .from("attendance_corrections")
    .update(patch)
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  let applicantName: string | null = null;
  const { data: ap } = await supabase
    .from("employees")
    .select("name, line_user_id")
    .eq("auth_user_id", corr.employee_id)
    .maybeSingle();
  const applicant = ap as {
    name: string | null;
    line_user_id: string | null;
  } | null;
  applicantName = applicant?.name ?? null;

  let companyName: string | null = null;
  const admin = createAdminClient();
  const { data: co } = await admin
    .from("companies")
    .select("name, settings")
    .eq("id", corr.company_id)
    .maybeSingle();
  companyName = (co as { name?: string } | null)?.name ?? null;
  const settings = normalizeCompanySettings(
    (co as { settings?: unknown } | null)?.settings,
  );

  const statusLabel = action === "approve" ? "承認済み" : "差戻し";
  const detail =
    action === "reject"
      ? `差戻し理由: ${rejectionReason}`
      : "ご申請の打刻修正が承認されました。";

  const mailCtx = {
    companyName: companyName ?? undefined,
    applicantName,
    targetDate: corr.target_date,
    statusLabel,
    detail,
  };
  const { subject, html } = buildAttendanceCorrectionMail(mailCtx);
  const lineText = `【打刻修正】${statusLabel}（${corr.target_date}）\n${detail}`;

  try {
    const emailTo = await getAuthUserEmail(admin, corr.employee_id);

    if (usesLineChannel(settings) && applicant?.line_user_id) {
      await enqueueNotification({
        company_id: corr.company_id,
        type: "attendance_correction_result",
        recipient_line_id: applicant.line_user_id,
        message: lineText,
        channel: "line",
      });
    }
    if (usesEmailChannel(settings) && emailTo) {
      await enqueueNotification({
        company_id: corr.company_id,
        type: "attendance_correction_result",
        recipient_line_id: null,
        recipient_email: emailTo,
        message: html,
        subject,
        channel: "email",
      });
    }
  } catch (e) {
    console.error("attendance correction notify:", e);
  }

  return NextResponse.json({ ok: true });
}
