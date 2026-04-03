import { getProfile, getSessionUser } from "@/lib/api-auth";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json({ error: "AI機能が未設定です" }, { status: 503 });
    }

    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const body = await req.json();
    const { goal_id } = body as { goal_id: string };
    if (!goal_id) return NextResponse.json({ error: "goal_id が必要です" }, { status: 400 });

    const { data: goal, error: gErr } = await supabase
      .from("monthly_goals")
      .select("*")
      .eq("id", goal_id)
      .single();
    if (gErr || !goal) return NextResponse.json({ error: "目標が見つかりません" }, { status: 404 });

    const g = goal as {
      year: number; month: number; theme: string;
      goals: unknown[]; kpis: unknown[];
      result_input: unknown; employee_id: string;
    };

    // チェックシート取得
    const { data: cs } = await supabase
      .from("check_sheets")
      .select("self_check, manager_check")
      .eq("employee_id", g.employee_id)
      .eq("year", g.year)
      .eq("month", g.month)
      .maybeSingle();

    const { data: emp } = await supabase
      .from("employees")
      .select("name, departments(name)")
      .eq("id", g.employee_id)
      .maybeSingle();
    const empName = (emp as { name?: string } | null)?.name ?? "従業員";

    const prompt = `あなたは人事評価の専門家です。以下の月間目標・KPI・実績・チェックシートを分析し、日本語で総合評価を行ってください。

【対象者】${empName}
【期間】${g.year}年${g.month}月

【テーマ】${g.theme}

【目標・KPI設定】
${JSON.stringify(g.goals, null, 2)}

【KPI】
${JSON.stringify(g.kpis, null, 2)}

【実績入力】
${JSON.stringify(g.result_input, null, 2)}

【チェックシート（自己評価）】
${cs ? JSON.stringify((cs as { self_check: unknown }).self_check, null, 2) : "未入力"}

【チェックシート（上司評価）】
${cs ? JSON.stringify((cs as { manager_check: unknown }).manager_check, null, 2) : "未入力"}

以下の形式でJSON出力してください:
{
  "score": <1〜100の総合スコア>,
  "evaluation": "<200〜400字の総合評価>",
  "strengths": ["<強み1>", "<強み2>"],
  "improvements": ["<改善点1>", "<改善点2>"],
  "next_month_advice": "<来月へのアドバイス（100〜200字）>"
}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = resp.content.find((c) => c.type === "text");
    const raw = text?.type === "text" ? text.text : "";

    let parsed: { score?: number; evaluation?: string; strengths?: string[]; improvements?: string[]; next_month_advice?: string } = {};
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { evaluation: raw, score: 0 };
    }

    // DB更新
    await supabase
      .from("monthly_goals")
      .update({
        ai_evaluation: JSON.stringify(parsed),
        ai_score: parsed.score ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal_id);

    return NextResponse.json({ evaluation: parsed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
