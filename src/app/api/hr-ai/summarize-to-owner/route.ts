import { getProfile, getSessionUser } from "@/lib/api-auth";
import { normalizeCompanySettings, usesLineChannel } from "@/lib/company-settings";
import {
  normalizeHrConversationHistory,
  type HrChatTurn,
} from "@/lib/hr-ai-messages";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-20250514";

function transcript(turns: HrChatTurn[]): string {
  return turns.map((t) => `${t.role}: ${t.content}`).join("\n\n---\n\n");
}

export const maxDuration = 60;

/**
 * 会話を要約し、会社の owner（代表・三原孔明氏など）向けに LINE 通知キューへ入れる。
 * ログ本文は送らず、テーマ要約のみ。
 */
export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "AI機能が未設定です（ANTHROPIC_API_KEY）" },
        { status: 503 },
      );
    }

    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = (await req.json()) as { conversation_id?: string };
    const conversationId = body.conversation_id?.trim();
    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id が必要です" }, { status: 400 });
    }

    const { data: row, error: selErr } = await supabase
      .from("hr_conversations")
      .select("id, messages, employee_id, company_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (selErr || !row) {
      return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });
    }
    const r = row as {
      employee_id: string;
      company_id: string;
      messages: unknown;
    };
    if (r.employee_id !== user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const turns = normalizeHrConversationHistory(r.messages);
    const userTurns = turns.filter((t) => t.role === "user");
    if (userTurns.length === 0) {
      return NextResponse.json(
        { error: "送信できる内容がありません（ユーザー発言がありません）" },
        { status: 400 },
      );
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || String(profile.company_id) !== r.company_id) {
      return NextResponse.json({ error: "プロフィールが一致しません" }, { status: 403 });
    }

    const employeeName = profile.name?.trim() || "（氏名未登録）";
    const { data: dept } = profile.department_id
      ? await supabase
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .maybeSingle()
      : { data: null };
    const deptName = (dept as { name?: string } | null)?.name ?? "未所属";

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sys = `あなたは人事向けの要約担当です。以下の会話は「スタッフ」と「AI人事アシスタント」のチャットです。
経営・人事担当者がフォローするために、相談のテーマ・論点・感情の傾向を180〜320字程度の日本語1段落で要約してください。
会話の逐語引用は禁止。個人の私生活で特定リスクが高い内容は抽象化してください。`;
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: sys,
      messages: [
        {
          role: "user",
          content: `会話テキスト:\n\n${transcript(turns)}`,
        },
      ],
    });
    const tb = resp.content.find((c) => c.type === "text");
    const summary =
      tb?.type === "text"
        ? tb.text.trim()
        : "（要約を生成できませんでした。会話の確認をお願いします）";

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          summary,
          notified: false,
          warning: "通知キューに接続できません（サーバー設定）",
        },
        { status: 200 },
      );
    }

    const { data: co } = await admin
      .from("companies")
      .select("settings")
      .eq("id", r.company_id)
      .maybeSingle();
    const settings = normalizeCompanySettings(
      (co as { settings?: unknown } | null)?.settings,
    );
    const lineOk = usesLineChannel(settings);

    const { data: owners } = await admin
      .from("employees")
      .select("line_user_id, name")
      .eq("company_id", r.company_id)
      .eq("role", "owner");

    const header = `【LENARD HR】AI人事アシスタント（要約連絡）\n${deptName} / ${employeeName} 様より相談がありました。\n※チャットの原文は転送していません。\n\n【相談内容の要約】\n`;
    const lineBody = `${header}${summary}`;

    let notified = false;
    if (lineOk) {
      for (const o of owners ?? []) {
        const lineId = (o as { line_user_id: string | null }).line_user_id?.trim();
        if (!lineId) continue;
        await enqueueNotification({
          company_id: r.company_id,
          type: "hr_ai_summary_to_owner",
          recipient_line_id: lineId,
          message: lineBody,
          channel: "line",
        });
        notified = true;
      }
    }

    return NextResponse.json({
      summary,
      notified,
      message: notified
        ? "代表向けに要約を通知キューに入れました（LINE 配信は環境により異なります）。"
        : lineOk
          ? "owner アカウントに LINE ID が未設定のため、キューへ入れませんでした。要約文は画面に表示されます。"
          : "会社通知設定が LINE 以外、または未設定のため、キューへ入れませんでした。要約文は画面に表示されます。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[hr-ai/summarize-to-owner]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
