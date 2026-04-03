import {
  normalizeCompanySettings,
  usesLineChannel,
} from "@/lib/company-settings";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";

/** 案件のインセンティブ提出時: 第1承認者・オーナーに LINE 通知 */
export async function notifyApproversDealSubmitted(input: {
  company_id: string;
  salon_name: string;
  year: number;
  month: number;
}) {
  try {
    const admin = createAdminClient();
    const { data: co } = await admin
      .from("companies")
      .select("settings")
      .eq("id", input.company_id)
      .maybeSingle();
    const settings = normalizeCompanySettings((co as { settings?: unknown } | null)?.settings);
    if (!usesLineChannel(settings)) return;

    const { data: admins } = await admin
      .from("employees")
      .select("line_user_id, name, role")
      .eq("company_id", input.company_id)
      .in("role", ["owner", "approver"]);

    const msg = `インセンティブ案件が提出されました（要承認）: ${input.salon_name}（${input.year}年${input.month}月）`;

    for (const a of admins ?? []) {
      const line = (a as { line_user_id: string | null }).line_user_id;
      if (line) {
        await enqueueNotification({
          company_id: input.company_id,
          type: "deal_incentive_submitted",
          recipient_line_id: line,
          message: msg,
        });
      }
    }
  } catch (e) {
    console.error("notifyApproversDealSubmitted:", e);
  }
}

/** 承認・差戻し時: 提出者に LINE 通知 */
export async function notifySubmitterDealDecision(input: {
  company_id: string;
  submitter_id: string | null;
  approved: boolean;
  salon_name: string;
  reason?: string | null;
}) {
  if (!input.submitter_id) return;
  try {
    const admin = createAdminClient();
    const { data: co } = await admin
      .from("companies")
      .select("settings")
      .eq("id", input.company_id)
      .maybeSingle();
    const settings = normalizeCompanySettings((co as { settings?: unknown } | null)?.settings);
    if (!usesLineChannel(settings)) return;

    const { data: sub } = await admin
      .from("employees")
      .select("line_user_id")
      .eq("id", input.submitter_id)
      .maybeSingle();

    const line = (sub as { line_user_id: string | null } | null)?.line_user_id;
    if (!line) return;

    const msg = input.approved
      ? `インセンティブ案件が承認されました: ${input.salon_name}`
      : `インセンティブ案件が差戻されました: ${input.salon_name}${input.reason ? `（理由: ${input.reason}）` : ""}`;

    await enqueueNotification({
      company_id: input.company_id,
      type: input.approved ? "deal_incentive_approved" : "deal_incentive_rejected",
      recipient_line_id: line,
      message: msg,
    });
  } catch (e) {
    console.error("notifySubmitterDealDecision:", e);
  }
}
