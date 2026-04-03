import { getProfile, getSessionUser } from "@/lib/api-auth";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const MODEL = "claude-sonnet-4-20250514";
const MAX_PDF_BYTES = 28 * 1024 * 1024;

const RULES_SUMMARY_INSTRUCTION = `以下は会社の就業規則PDFです。
従業員からの質問に答えられるよう、
重要なルール・規定・手続きを詳しく要約してください。
特に以下を含めてください：
- 勤務時間・休憩・残業規定
- 有給休暇・特別休暇の取得方法
- 経費精算のルール
- 服務規律・禁止事項
- 給与・賞与の規定
- 懲戒・処分の規定

出力は日本語のマークダウンまたは見出し付きテキストで構造化してください。`;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI機能が未設定です（ANTHROPIC_API_KEY）" },
        { status: 503 },
      );
    }

    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !["owner", "approver"].includes(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { document_id?: string };
    const documentId = body.document_id?.trim();
    if (!documentId) {
      return NextResponse.json({ error: "document_id が必要です" }, { status: 400 });
    }

    const { data: doc, error: docErr } = await supabase
      .from("company_documents")
      .select("id, company_id, name, file_path")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return NextResponse.json({ error: "ドキュメントが見つかりません" }, { status: 404 });
    }

    const row = doc as { company_id: string; file_path: string; name: string };
    if (row.company_id !== profile.company_id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(row.file_path, 3600);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message ?? "署名付きURLの取得に失敗しました" },
        { status: 500 },
      );
    }

    const pdfRes = await fetch(signed.signedUrl);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: `PDFの取得に失敗しました（${pdfRes.status}）` },
        { status: 502 },
      );
    }

    const buf = Buffer.from(await pdfRes.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDFが大きすぎます（28MB以下にしてください）" },
        { status: 400 },
      );
    }

    const base64 = buf.toString("base64");

    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: RULES_SUMMARY_INSTRUCTION,
            },
          ],
        },
      ],
    });

    const textBlock = resp.content.find((c) => c.type === "text");
    const summary =
      textBlock?.type === "text" ? textBlock.text.trim() : "";

    if (!summary) {
      return NextResponse.json({ error: "要約を生成できませんでした" }, { status: 500 });
    }

    const { error: upErr } = await supabase
      .from("company_documents")
      .update({ ai_summary: summary })
      .eq("id", documentId)
      .eq("company_id", profile.company_id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      document_id: documentId,
      ai_summary: summary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[company-documents/summarize]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
