import { getProfile, getSessionUser } from "@/lib/api-auth";
import { buildHrAiSystemPrompt } from "@/lib/hr-ai-build-prompt";
import {
  normalizeHrConversationHistory,
  type HrChatTurn,
} from "@/lib/hr-ai-messages";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-20250514";
const MAX_PRIOR_TURNS = 24;

export const maxDuration = 120;

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

    const body = (await req.json()) as {
      message?: string;
      conversation_history?: unknown;
      conversation_id?: string | null;
    };
    const message = String(body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    const systemPrompt = await buildHrAiSystemPrompt(supabase, user.id);
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "プロフィールが見つかりません" },
        { status: 403 },
      );
    }

    let prior: HrChatTurn[] = [];
    let conversationId = body.conversation_id?.trim() || null;

    if (conversationId) {
      const { data: row, error } = await supabase
        .from("hr_conversations")
        .select("messages, employee_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (error || !row || (row as { employee_id: string }).employee_id !== user.id) {
        return NextResponse.json({ error: "会話が見つかりません" }, { status: 403 });
      }
      prior = normalizeHrConversationHistory((row as { messages: unknown }).messages);
    } else {
      prior = normalizeHrConversationHistory(body.conversation_history);
    }

    prior = prior.slice(-MAX_PRIOR_TURNS);

    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      ...prior.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const textBlock = resp.content.find((c) => c.type === "text");
    const assistantText =
      textBlock?.type === "text" ? textBlock.text : "（応答を生成できませんでした）";

    const newMessages: HrChatTurn[] = [
      ...prior,
      { role: "user", content: message },
      { role: "assistant", content: assistantText },
    ];

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    if (conversationId) {
      const { error: upErr } = await supabase
        .from("hr_conversations")
        .update({
          messages: newMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("employee_id", user.id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("hr_conversations")
        .insert({
          company_id: profile.company_id,
          employee_id: user.id,
          messages: newMessages,
        })
        .select("id")
        .single();
      if (insErr || !ins) {
        return NextResponse.json(
          { error: insErr?.message ?? "会話の保存に失敗しました" },
          { status: 500 },
        );
      }
      conversationId = (ins as { id: string }).id;
    }

    return NextResponse.json({
      reply: assistantText,
      conversation_id: conversationId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[hr-ai]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
