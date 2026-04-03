/**
 * 手動の第1／最終承認。新規申請時の AI 審査・自動承認は POST /api/expenses で行います。
 */
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
import { buildApprovalRequestMail, buildExpenseApprovedMail } from "@/lib/email";
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

    const body = (await req.json()) as { action?: string };
    const action = body.action;
    if (action !== "step1" && action !== "step2") {
      return NextResponse.json({ error: "action は step1 または step2" }, { status: 400 });
    }

    if (action === "step1" && !isApprover(profile.role)) {
      return NextResponse.json({ error: "第1承認の権限がありません" }, { status: 403 });
    }
    if (action === "step2" && !isOwner(profile.role)) {
      return NextResponse.json({ error: "最終承認の権限がありません" }, { status: 403 });
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
      id: string;
      status: string;
      submitter_id: string;
      amount: number;
      category: string;
    };

    const now = new Date().toISOString();

    if (action === "step1") {
      if (row.status !== "step1_pending") {
        return NextResponse.json({ error: "第1承認対象のステータスではありません" }, { status: 400 });
      }
      const { error: upErr } = await supabase
        .from("expenses")
        .update({
          status: "step2_pending",
          step1_approved_by: user.id,
          step1_approved_at: now,
          updated_at: now,
        })
        .eq("id", id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      const { error: logErr } = await supabase.from("approval_logs").insert({
        company_id: profile.company_id,
        target_type: "expense",
        target_id: id,
        action: "step1_approve",
        actor_id: user.id,
        actor_name: profile.name,
      });
      if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 });
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
        const { data: subMeta } = await admin
          .from("employees")
          .select("name")
          .eq("auth_user_id", row.submitter_id)
          .maybeSingle();
        const applicantName = (subMeta as { name: string | null } | null)
          ?.name;
        const { data: owners } = await admin
          .from("employees")
          .select("id, line_user_id")
          .eq("role", "owner")
          .eq("company_id", profile.company_id);
        const msg = `経費: 最終承認待ち（第1承認済）カテゴリ ${row.category} / ¥${Number(row.amount).toLocaleString("ja-JP")}`;
        const { subject: emSubj, html: emHtml } = buildApprovalRequestMail({
          companyName: companyName ?? undefined,
          applicantName,
          category: row.category,
          amount: row.amount,
          flowStatus: "最終承認待ち（第1承認済）",
        });
        for (const o of owners ?? []) {
          const line = (o as { line_user_id: string | null }).line_user_id;
          if (usesLineChannel(settings) && line) {
            await enqueueNotification({
              company_id: profile.company_id,
              type: "expense_step2_request",
              recipient_line_id: line,
              message: msg,
            });
          }
          if (usesEmailChannel(settings)) {
            const ownerId = (o as { id: string }).id;
            const email = await getAuthUserEmail(admin, ownerId);
            if (email) {
              await enqueueNotification({
                company_id: profile.company_id,
                type: "expense_step2_request",
                recipient_line_id: null,
                recipient_email: email,
                message: emHtml,
                subject: emSubj,
                channel: "email",
              });
            }
          }
        }
      } catch {
        /* ignore */
      }

      return NextResponse.json({ ok: true });
    }

    /* step2 */
    if (row.status !== "step2_pending") {
      return NextResponse.json({ error: "最終承認対象のステータスではありません" }, { status: 400 });
    }
    const { error: up2 } = await supabase
      .from("expenses")
      .update({
        status: "approved",
        step2_approved_by: user.id,
        step2_approved_at: now,
        updated_at: now,
      })
      .eq("id", id);
    if (up2) {
      return NextResponse.json({ error: up2.message }, { status: 500 });
    }

    const { error: log2 } = await supabase.from("approval_logs").insert({
      company_id: profile.company_id,
      target_type: "expense",
      target_id: id,
      action: "step2_approve",
      actor_id: user.id,
      actor_name: profile.name,
    });
    if (log2) {
      return NextResponse.json({ error: log2.message }, { status: 500 });
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
        .from("employees")
        .select("line_user_id, name")
        .eq("auth_user_id", row.submitter_id)
        .maybeSingle();
      const line = (sub as { line_user_id: string | null } | null)?.line_user_id ?? null;
      const submitterName = (sub as { name: string | null } | null)?.name;
      const lineMsg = `経費申請が承認されました（${row.category} ¥${Number(row.amount).toLocaleString("ja-JP")}）`;
      if (usesLineChannel(settings) && line) {
        await enqueueNotification({
          company_id: profile.company_id,
          type: "expense_approved",
          recipient_line_id: line,
          message: lineMsg,
        });
      }
      if (usesEmailChannel(settings)) {
        const email = await getAuthUserEmail(admin, row.submitter_id);
        if (email) {
          const { subject, html } = buildExpenseApprovedMail({
            companyName: companyName ?? undefined,
            applicantName: submitterName,
            category: row.category,
            amount: row.amount,
          });
          await enqueueNotification({
            company_id: profile.company_id,
            type: "expense_approved",
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
