import { getAuthUserEmail } from "@/lib/auth-user-email";
import {
  normalizeCompanySettings,
  usesEmailChannel,
  usesLineChannel,
} from "@/lib/company-settings";
import { buildExpenseApprovedMail } from "@/lib/email";
import { enqueueNotification } from "@/lib/notification-queue";
import type { SupabaseClient } from "@supabase/supabase-js";

const AI_AUTO_SCORE_MIN = 80;

/** 参加人数のおおまか推定（接待の per_person 用） */
export function estimateAttendeeCount(attendees: string | null | undefined): number {
  const s = attendees?.trim() ?? "";
  if (!s) return 1;
  const m = s.match(/(\d+)\s*名/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const firstNum = s.match(/\d+/);
  if (firstNum) return Math.max(1, parseInt(firstNum[0], 10));
  const parts = s.split(/[,、]/).map((x) => x.trim()).filter(Boolean);
  return Math.max(1, parts.length);
}

type ExpenseRow = {
  id: string;
  company_id: string;
  status: string;
  category: string;
  amount: number;
  submitter_id: string;
  audit_score: number | null;
};

/**
 * step1_pending かつ AIスコア・ルールを満たす場合に approved + auto_approved に更新。
 * service_role クライアントで呼ぶこと（RLS バイパス）。
 */
export async function tryAutoApproveExpense(
  admin: SupabaseClient,
  expenseId: string,
): Promise<{ approved: boolean }> {
  const { data: expRaw, error: fe } = await admin
    .from("expenses")
    .select("id, company_id, status, category, amount, submitter_id, audit_score")
    .eq("id", expenseId)
    .maybeSingle();
  if (fe || !expRaw) return { approved: false };
  const exp = expRaw as ExpenseRow;
  if (exp.status !== "step1_pending") return { approved: false };
  if (exp.audit_score == null || exp.audit_score < AI_AUTO_SCORE_MIN) {
    return { approved: false };
  }

  const { data: ruleRaw } = await admin
    .from("auto_approval_rules")
    .select("max_amount, per_person, is_enabled")
    .eq("company_id", exp.company_id)
    .eq("category", exp.category)
    .maybeSingle();
  if (!ruleRaw) return { approved: false };
  const rule = ruleRaw as {
    max_amount: number | null;
    per_person: boolean;
    is_enabled: boolean;
  };
  if (!rule.is_enabled) return { approved: false };

  const maxAmt = rule.max_amount != null ? Number(rule.max_amount) : 0;
  const { data: expFull } = await admin
    .from("expenses")
    .select("attendees")
    .eq("id", expenseId)
    .single();
  const attendees = (expFull as { attendees?: string | null } | null)?.attendees ?? null;

  const divisor = rule.per_person ? estimateAttendeeCount(attendees) : 1;
  const unitAmount = Number(exp.amount) / divisor;
  if (!Number.isFinite(unitAmount) || unitAmount > maxAmt) {
    return { approved: false };
  }

  const now = new Date().toISOString();
  const { data: owner } = await admin
    .from("employees")
    .select("id")
    .eq("company_id", exp.company_id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const actorId =
    (owner as { id: string } | null)?.id ?? exp.submitter_id;

  const { error: upErr } = await admin
    .from("expenses")
    .update({
      status: "approved",
      auto_approved: true,
      step1_approved_at: now,
      step2_approved_at: now,
      updated_at: now,
    })
    .eq("id", expenseId);
  if (upErr) {
    console.error("[tryAutoApproveExpense] update", upErr.message);
    return { approved: false };
  }

  const { error: logErr } = await admin.from("approval_logs").insert({
    company_id: exp.company_id,
    target_type: "expense",
    target_id: expenseId,
    action: "ai_auto_approve",
    actor_id: actorId,
    actor_name: "AI自動承認",
    reason: `単価基準 ¥${Math.floor(unitAmount).toLocaleString("ja-JP")} / 上限 ¥${maxAmt.toLocaleString("ja-JP")} / AIスコア ${exp.audit_score}`,
  });
  if (logErr) {
    console.error("[tryAutoApproveExpense] log", logErr.message);
  }

  try {
    const { data: co } = await admin
      .from("companies")
      .select("settings, name")
      .eq("id", exp.company_id)
      .maybeSingle();
    const settings = normalizeCompanySettings(
      (co as { settings?: unknown } | null)?.settings,
    );
    const companyName = (co as { name?: string } | null)?.name;
    const { data: sub } = await admin
      .from("employees")
      .select("line_user_id, name")
      .eq("id", exp.submitter_id)
      .maybeSingle();
    const line =
      (sub as { line_user_id: string | null } | null)?.line_user_id ?? null;
    const submitterName = (sub as { name: string | null } | null)?.name;
    const lineMsg = `経費が自動承認されました（${exp.category} ¥${Number(exp.amount).toLocaleString("ja-JP")}）`;
    if (usesLineChannel(settings) && line) {
      await enqueueNotification({
        company_id: exp.company_id,
        type: "expense_auto_approved",
        recipient_line_id: line,
        message: lineMsg,
      });
    }
    if (usesEmailChannel(settings)) {
      const email = await getAuthUserEmail(admin, exp.submitter_id);
      if (email) {
        const { subject, html } = buildExpenseApprovedMail({
          companyName: companyName ?? undefined,
          applicantName: submitterName,
          category: exp.category,
          amount: exp.amount,
          extraNote: "AI審査と自動承認ルールにより、そのまま承認が完了しました。",
        });
        await enqueueNotification({
          company_id: exp.company_id,
          type: "expense_auto_approved",
          recipient_line_id: null,
          recipient_email: email,
          message: html,
          subject,
          channel: "email",
        });
      }
    }
  } catch (e) {
    console.error("[tryAutoApproveExpense] notify", e);
  }

  return { approved: true };
}
