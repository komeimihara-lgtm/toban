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
import { getAuthUserEmail } from "@/lib/auth-user-email";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  if (!isOwnerOrApprover(profile.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { user_id?: string };
  const target = String(body.user_id ?? "").trim();
  if (!target) {
    return NextResponse.json({ error: "user_id が必要です" }, { status: 400 });
  }

  const { data: tp } = await supabase
    .from("profiles")
    .select("company_id, line_user_id, full_name")
    .eq("id", target)
    .maybeSingle();
  const row = tp as {
    company_id: string;
    line_user_id: string | null;
    full_name: string | null;
  } | null;
  if (!row || row.company_id !== profile.company_id) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "サーバー設定エラー" }, { status: 503 });
  }

  const { data: co } = await admin
    .from("companies")
    .select("settings, name")
    .eq("id", profile.company_id)
    .maybeSingle();
  const settings = normalizeCompanySettings(
    (co as { settings?: unknown } | null)?.settings,
  );

  const name = row.full_name?.trim() || "ご担当者";
  const lineMsg = `【LENARD HR】${name} 様\n入社手続きに未完了のタスクがあります。アプリの「入社手続き」からご確認ください。`;

  try {
    if (usesLineChannel(settings) && row.line_user_id) {
      await enqueueNotification({
        company_id: profile.company_id,
        type: "onboarding_remind",
        recipient_line_id: row.line_user_id,
        message: lineMsg,
        channel: "line",
      });
    }
    const emailTo = await getAuthUserEmail(admin, target);
    if (usesEmailChannel(settings) && emailTo) {
      const coName = (co as { name?: string } | null)?.name ?? "レナード株式会社";
      const subject = `【LENARD HR】入社手続きリマインドのお知らせ`;
      const html = `<!DOCTYPE html><html lang="ja"><body style="font-family:system-ui,sans-serif">
        <p>${coName}</p>
        <p>${name} 様</p>
        <p>入社手続きに未完了のタスクがあります。LENARD HR の「入社手続き」からご確認ください。</p>
      </body></html>`;
      await enqueueNotification({
        company_id: profile.company_id,
        type: "onboarding_remind",
        recipient_line_id: null,
        recipient_email: emailTo,
        message: html,
        subject,
        channel: "email",
      });
    }
  } catch (e) {
    console.error("onboarding remind:", e);
    return NextResponse.json({ error: "通知キュー投入に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
