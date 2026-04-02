import {
  getProfile,
  getSessionUser,
  isApprover,
  isOwner,
} from "@/lib/api-auth";
import { getAuthUserEmail } from "@/lib/auth-user-email";
import {
  normalizeCompanySettings,
  usesEmailChannel,
  usesLineChannel,
} from "@/lib/company-settings";
import { buildExpenseRejectedMail } from "@/lib/email";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    const body = (await req.json()) as { reason?: string };
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "差戻し理由は必須です" }, { status: 400 });
    }

    const { data: exp, error: fetchErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !exp) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }

    const row = exp as {
      status: string;
      submitter_id: string;
      category: string;
      amount: number;
    };
    const st = row.status;

    const canApproverReject = isApprover(profile.role) && st === "step1_pending";
    const canOwnerReject =
      isOwner(profile.role) && (st === "step1_pending" || st === "step2_pending");

    if (!canApproverReject && !canOwnerReject) {
      return NextResponse.json({ error: "差戻しの権限がある状態ではありません" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error: up } = await supabase
      .from("expenses")
      .update({
        status: "rejected",
        rejection_reason: reason,
        rejected_by_id: user.id,
        updated_at: now,
      })
      .eq("id", id);
    if (up) {
      return NextResponse.json({ error: up.message }, { status: 500 });
    }

    const { error: logE } = await supabase.from("approval_logs").insert({
      company_id: profile.company_id,
      target_type: "expense",
      target_id: id,
      action: "reject",
      actor_id: user.id,
      actor_name: profile.full_name,
      reason,
    });
    if (logE) {
      return NextResponse.json({ error: logE.message }, { status: 500 });
    }

    try {
      const admin = createAdminClient();
      const { data: co } = await admin
        .from("companies")
        .select("settings, name")
        .eq("id", profile.company_id)
        .maybeSingle();
      const settings = normalizeCompanySettings(
        (co as { settings?: unknown } | null)?.settings,
      );
      const companyName = (co as { name?: string } | null)?.name;
      const { data: sub } = await admin
        .from("profiles")
        .select("line_user_id, full_name")
        .eq("id", row.submitter_id)
        .maybeSingle();
      const line = (sub as { line_user_id: string | null } | null)?.line_user_id ?? null;
      const subName = (sub as { full_name: string | null } | null)?.full_name;
      const lineMsg = `経費が差戻されました: ${reason}`;
      if (usesLineChannel(settings) && line) {
        await enqueueNotification({
          company_id: profile.company_id,
          type: "expense_rejected",
          recipient_line_id: line,
          message: lineMsg,
        });
      }
      if (usesEmailChannel(settings)) {
        const email = await getAuthUserEmail(admin, row.submitter_id);
        if (email) {
          const { subject, html } = buildExpenseRejectedMail(
            {
              companyName: companyName ?? undefined,
              applicantName: subName,
              category: row.category,
              amount: row.amount,
            },
            reason,
          );
          await enqueueNotification({
            company_id: profile.company_id,
            type: "expense_rejected",
            recipient_line_id: null,
            recipient_email: email,
            message: html,
            subject,
            channel: "email",
          });
        }
      }
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
