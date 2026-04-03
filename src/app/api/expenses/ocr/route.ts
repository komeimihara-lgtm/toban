import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MODEL = "claude-opus-4-5-20250918";

const SYSTEM_PROMPT = `あなたはレシート・領収書画像から情報を正確に読み取る専門家です。
画像から以下の情報をJSON形式で抽出してください。読み取れない項目はnullにしてください。

出力は必ず以下のJSON形式のみ（マークダウン禁止）:
{"date":"YYYY-MM-DD","amount":数値,"vendor":"店舗名","category":"カテゴリ"}

カテゴリは以下から最も適切なものを選択:
交通費, 接待交際費, 通信費, 消耗品費, 書籍研修費, 広告宣伝費, 出張費（交通）, 出張費（宿泊）, その他

- dateはYYYY-MM-DD形式に変換（和暦や「令和」等も西暦に変換）
- amountは税込の合計金額（数値のみ、円記号やカンマなし）
- vendorは正式な店舗名・会社名
- 飲食店のレシートで人数が多い場合は接待交際費を優先`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定です" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  let body: { image?: string; mediaType?: string };
  try {
    body = (await request.json()) as { image?: string; mediaType?: string };
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const { image, mediaType } = body;
  if (!image || !mediaType) {
    return NextResponse.json(
      { error: "画像データが必要です" },
      { status: 400 },
    );
  }

  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ] as const;
  type MediaType = (typeof validTypes)[number];
  if (!validTypes.includes(mediaType as MediaType)) {
    return NextResponse.json(
      { error: "サポートされていない画像形式です" },
      { status: 400 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as MediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: "このレシート・領収書の情報を読み取ってください。",
            },
          ],
        },
      ],
    });

    const textBlock = resp.content.find((c) => c.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "{}";
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      date?: string;
      amount?: number;
      vendor?: string;
      category?: string;
    };

    return NextResponse.json({
      date: typeof parsed.date === "string" ? parsed.date : null,
      amount:
        typeof parsed.amount === "number" && parsed.amount > 0
          ? parsed.amount
          : null,
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      category: typeof parsed.category === "string" ? parsed.category : null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OCR処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
