import Anthropic from "@anthropic-ai/sdk";
import type { ExpenseAuditIssue, ExpenseAuditResult } from "@/types/expense-audit";

const MODEL = "claude-sonnet-4-20250514";

type NarrativeInput = {
  expenseSummary: string;
  issues: ExpenseAuditIssue[];
  score: number;
  verdict: ExpenseAuditResult["verdict"];
};

export async function claudeExpenseAuditNarrative(
  input: NarrativeInput,
): Promise<{ summary: string; suggestions: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return {
      summary: "AIサマリーはスキップされました（ANTHROPIC_API_KEY 未設定）。",
      suggestions: [],
    };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sys = `あなたは経費の第1承認者・最終承認者の視点で、申請者の改善のためのコメントを書く専門家です。
トーン: 厳しすぎず・甘すぎず。差戻しではなく「確認事項」として書く。
出力は必ず JSON のみ（マークダウン禁止）: {"summary":"1-2文の日本語","suggestions":["具体的な改善提案3-5件"]}
コスト意識: suggestions には必ず円建ての目安を1件以上入れる（例: 「タクシー→電車に変更で月間約¥12,000削減の可能性」）。
宿泊・ホテルが話題のときは必ず会社目安を明示: 「会社推奨の宿泊費は¥6,000〜¥7,000/泊です。¥8,000を超える場合は理由を記載してください」「¥7,000台のビジネスホテルに変更することで¥XXX節約可能」など（XXX は issues の saving_amount があれば優先）。
検出済み確認事項に saving_amount があればそれを引用してよい。`;

  const user = JSON.stringify(
    {
      経費概要: input.expenseSummary,
      検出済み確認事項: input.issues,
      スコア: input.score,
      判定ラベル: input.verdict,
    },
    null,
    2,
  );

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: sys,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = resp.content.find((c) => c.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "{}";
  try {
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    const j = JSON.parse(cleaned) as { summary?: string; suggestions?: unknown };
    const summary =
      typeof j.summary === "string" && j.summary.trim()
        ? j.summary.trim()
        : "確認事項を踏まえ、用途・証憑の補足をおすすめします。";
    const suggestions = Array.isArray(j.suggestions)
      ? j.suggestions.map((x) => String(x)).filter(Boolean)
      : [];
    return { summary, suggestions };
  } catch {
    return {
      summary:
        "審査ルールに基づき確認事項を列挙しました。詳細は issues をご確認ください。",
      suggestions: [],
    };
  }
}
