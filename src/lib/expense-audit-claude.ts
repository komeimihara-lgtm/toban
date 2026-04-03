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
  const sys = `あなたは経費の承認者（第1承認・千葉、最終承認・三原孔明）の視点で、申請者の改善のためのコメントを書く専門家です。
トーン: 厳しすぎず・甘すぎず。差戻しではなく「確認事項」として書く。
出力は必ず JSON のみ（マークダウン禁止）: {"summary":"1-2文の日本語","suggestions":["具体的な改善提案3-5件"]}
コスト意識（必須）: suggestions には具体的な円建てを2件以上含める。例:「タクシー→電車に変更で月間約¥12,000削減可能」「ホテルをビジネスホテル（目安1泊¥8,000）に変更で約¥8,000節約可能」「レンタカー→電車+タクシーで約¥3,500削減可能」。
宿泊が検出されている場合は 1泊¥8,000前後のビジネスホテルへの置き換え削減額を saving_amount や金額から推定して書く。
検出済み issues に saving_amount があれば必ず1件はその数値を引用する。`;

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
