import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_COMPANY_ID } from "@/lib/company";
import { isIncentiveEligible, type ProfileRow } from "@/types/incentive";

function yearMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function roleLabel(role: string) {
  if (role === "owner") return "オーナー／経営";
  if (role === "approver") return "第1承認者";
  return "スタッフ";
}

/** Claude の system プロンプト用コンテキスト（ログインユーザーのみ） */
export async function buildHrAiSystemPrompt(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("employees")
    .select(
      "id, company_id, name, role, department_id, is_sales_target, is_service_target, departments ( name )",
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  const p = profile as (ProfileRow & {
    departments?: { name: string } | null;
  }) | null;
  if (!p) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("name, settings")
    .eq("id", p.company_id)
    .maybeSingle();
  const companyName = (company as { name?: string } | null)?.name ?? "御社";
  const rawSettingsEarly = (company as { settings?: Record<string, unknown> } | null)
    ?.settings;

  const { data: leaveRow } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, next_accrual_date, next_accrual_days")
    .eq("user_id", userId)
    .maybeSingle();
  const leave = leaveRow as {
    days_remaining?: number | null;
    next_accrual_date?: string | null;
    next_accrual_days?: number | null;
  } | null;

  let incentiveLine = "（インセンティブ対象外、または未設定）";
  if (isIncentiveEligible(p)) {
    const ym = yearMonthKey();
    const { data: rateR } = await supabase
      .from("incentive_rates")
      .select("rate")
      .eq("user_id", userId)
      .eq("company_id", p.company_id)
      .eq("year_month", ym)
      .maybeSingle();
    const { data: sub } = await supabase
      .from("incentive_submissions")
      .select("sales_amount, rate_snapshot, status")
      .eq("user_id", userId)
      .eq("company_id", p.company_id)
      .eq("year_month", ym)
      .maybeSingle();
    const r = rateR ? Number((rateR as { rate: number }).rate) : 0;
    const base =
      sub?.sales_amount != null ? Number(sub.sales_amount as number) : null;
    const rs =
      sub?.rate_snapshot != null ? Number(sub.rate_snapshot as number) : r;
    const st = (sub as { status?: string } | null)?.status ?? "なし";
    if (base != null && rs) {
      incentiveLine = `今月の提出ステータス: ${st}。試算額（概算）: ${Math.floor(base * rs).toLocaleString("ja-JP")} 円（売上 ${base.toLocaleString("ja-JP")} 円 × 率 ${(rs * 100).toFixed(2)}%）`;
    } else if (rs) {
      incentiveLine = `今月の提出: ${st}。適用率 ${(rs * 100).toFixed(2)}%（実績入力後に試算可能）`;
    } else {
      incentiveLine = `今月の提出: ${st}。率未設定または実績未入力のため試算なし`;
    }
  }

  const { data: expRows } = await supabase
    .from("expenses")
    .select("status, amount, category, paid_date")
    .eq("submitter_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const byStatus: Record<string, number> = {};
  for (const row of expRows ?? []) {
    const s = (row as { status: string }).status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const recentExpenseLines = (expRows ?? []).slice(0, 6).map((row) => {
    const x = row as { status: string; amount: number; category: string; paid_date: string };
    return `${x.paid_date} / ${x.category} / ${x.status} / ¥${Number(x.amount).toLocaleString("ja-JP")}`;
  });
  const expensesSummary =
    Object.keys(byStatus).length === 0
      ? "新・経費（expenses）: 該当なし"
      : `新・経費（expenses）ステータス件数: ${Object.entries(byStatus)
          .map(([k, v]) => `${k}=${v}件`)
          .join(", ")}。直近の申請（最大6件）: ${recentExpenseLines.join(" ／ ")}`;

  const hrFromSettings = rawSettingsEarly?.hr_documents;
  let settingsHrDocBlock = "";
  if (Array.isArray(hrFromSettings)) {
    settingsHrDocBlock = hrFromSettings
      .map((item, i) => {
        if (!item || typeof item !== "object") return "";
        const o = item as Record<string, unknown>;
        const title = o.title != null ? String(o.title) : `文書${i + 1}`;
        const content = o.content != null ? String(o.content) : "";
        return `【settings.${title}】\n${content}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  } else if (typeof hrFromSettings === "string" && hrFromSettings.trim()) {
    settingsHrDocBlock = `【companies.settings.hr_documents（テキスト）】\n${hrFromSettings.trim()}`;
  }

  const { data: legacyPending } = await supabase
    .from("expense_claims")
    .select("id, status, amount, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const legacyLines =
    (legacyPending ?? []).length === 0
      ? "簡易経費（expense_claims）: 直近なし"
      : `簡易経費（直近）: ${(legacyPending ?? [])
          .map((r) => {
            const x = r as {
              status: string;
              amount: number;
              category: string;
            };
            return `${x.category} / ${x.status} / ${Number(x.amount).toLocaleString("ja-JP")}円`;
          })
          .join("； ")}`;

  const { data: docs } = await supabase
    .from("hr_documents")
    .select("category, title, content")
    .eq("company_id", p.company_id)
    .eq("is_active", true)
    .order("category");

  const docBlocks = (docs ?? [])
    .map((d) => {
      const row = d as { category: string; title: string; content: string };
      return `【${row.category}】${row.title}\n${row.content}`;
    })
    .join("\n\n---\n\n");

  // company_documents（就業規則PDF等）のAI要約を取得
  const { data: companyDocs } = await supabase
    .from("company_documents")
    .select("name, document_type, ai_summary")
    .eq("company_id", p.company_id)
    .order("created_at", { ascending: false });

  const companyDocBlocks = (companyDocs ?? [])
    .filter((d) => (d as { ai_summary: string | null }).ai_summary)
    .map((d) => {
      const row = d as { name: string; document_type: string; ai_summary: string };
      return `【就業規則: ${row.name}】\n${row.ai_summary}`;
    })
    .join("\n\n---\n\n");

  const deptName = p.departments?.name ?? "未所属";
  const employeeName = p.name?.trim() ?? "（氏名未登録）";
  const contactHint =
    p.company_id === DEFAULT_COMPANY_ID
      ? "管理本部の千葉さんに確認してください"
      : "貴社の人事・管理本部に確認してください";

  const settingsSupplement =
    settingsHrDocBlock.trim().length > 0
      ? `\n\n【company_settings 由来の hr_documents（補足）】\n${settingsHrDocBlock}`
      : "";

  const rulesDocSupplement =
    companyDocBlocks.trim().length > 0
      ? `\n\n【就業規則ドキュメント（PDF要約）】\n以下は会社の就業規則です。質問には必ずこの規則に基づいて回答してください。\n${companyDocBlocks}`
      : "";

  return `あなたは${companyName}の専任AI人事アシスタントです。
以下のことができます:
1. 有給残日数・取得状況の確認と回答
2. 雇用契約・就業規則の案内（下記「社内文書」および company_settings.hr_documents の補足に基づく。実際の契約・規程の優先）
3. 評価制度の説明と評価を上げるためのアドバイス
4. キャリア相談・進路相談
5. 悩み相談（傾聴・アドバイス）
6. 経費申請の状況確認
7. インセンティブの確認

【このユーザー固有データ（他のスタッフには言及・推測・開示しない）】
- 氏名: ${employeeName}
- 部署: ${deptName}
- ロール: ${roleLabel(p.role)}
- 有給残: ${leave?.days_remaining != null ? `${leave.days_remaining} 日` : "不明"}（次回付与日 ${leave?.next_accrual_date ?? "—"}${leave?.next_accrual_days != null ? `、付与日数 ${leave.next_accrual_days}` : ""}）
- 今月のインセンティブ: ${incentiveLine}
- 経費: ${expensesSummary}
- 経費（旧フォーム）: ${legacyLines}

【社内文書（参照用・ダミー含む可能性あり）】
${docBlocks || "（文書が未登録です。一般的な労働法知識で案内し、確約は避けてください）"}${settingsSupplement}${rulesDocSupplement}

【厳守事項】
- 個人情報・他従業員の情報は開示しない。ユーザー本人の文脈内に留める。
- 答えられないこと・確約できないことは「${contactHint}」と案内する。
- 法律・税務・確定した労務判断が必要な質問は、${contactHint}。
- 文書と矛盾する場合は必ず人事確認を促す。
応答は丁寧な日本語で、簡潔に。`;
}
