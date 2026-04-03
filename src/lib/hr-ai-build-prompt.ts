import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_COMPANY_ID } from "@/lib/company";
import { isIncentiveEligible, type ProfileRow } from "@/types/incentive";

function yearMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function jstMonthBounds() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  const startIso = new Date(`${y}-${mm}-01T00:00:00+09:00`).toISOString();
  const endIso = new Date(
    `${y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999+09:00`,
  ).toISOString();
  return { startIso, endIso, label: `${y}年${m}月` };
}

function attendanceSummaryFromPunches(
  rows: { punched_at: string; punch_type: string }[],
  monthLabel: string,
): string {
  if (!rows.length) {
    return `${monthLabel}の打刻: なし`;
  }
  type Entry = { t: number; type: string };
  const byDay = new Map<string, Entry[]>();
  for (const r of rows) {
    const t = new Date(r.punched_at).getTime();
    if (Number.isNaN(t)) continue;
    const day = new Date(r.punched_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Tokyo",
    });
    const list = byDay.get(day) ?? [];
    list.push({ t, type: r.punch_type });
    byDay.set(day, list);
  }
  let totalMin = 0;
  let daysWithSpan = 0;
  for (const [, list] of byDay) {
    list.sort((a, b) => a.t - b.t);
    const firstIn = list.find((x) => x.type === "clock_in");
    const lastOut = [...list].reverse().find((x) => x.type === "clock_out");
    if (firstIn && lastOut && lastOut.t > firstIn.t) {
      totalMin += (lastOut.t - firstIn.t) / 60000;
      daysWithSpan += 1;
    }
  }
  const totalH = totalMin / 60;
  const overtimeApprox = Math.max(0, totalH - 8 * daysWithSpan);
  return `${monthLabel}: 出勤日数（打刻のある日）${byDay.size}日、総労働時間（初出勤〜最終退勤の概算）${totalH.toFixed(1)}時間、残業概算（8h×出退ペアがある日数を控除）${overtimeApprox.toFixed(1)}時間`;
}

function roleLabel(role: string) {
  if (role === "owner") return "オーナー／経営";
  if (role === "director") return "取締役";
  if (role === "approver") return "第1承認者";
  if (role === "sr") return "社労士";
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
      "id, company_id, name, role, department_id, is_sales_target, is_service_target, is_contract, is_part_time, created_at, departments ( name )",
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  const p = profile as (ProfileRow & {
    departments?: { name: string } | null;
    is_contract?: boolean | null;
    is_part_time?: boolean | null;
    created_at?: string | null;
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

  const { data: grantRows } = await supabase
    .from("paid_leave_grants")
    .select("grant_date, days_granted, days_remaining, grant_reason, expires_at")
    .eq("employee_id", userId)
    .order("grant_date", { ascending: false })
    .limit(8);

  const grantsLines = (grantRows ?? []).map((g) => {
    const x = g as {
      grant_date: string;
      days_granted: number;
      days_remaining: number;
      grant_reason: string;
      expires_at?: string | null;
    };
    return `${x.grant_date} 付与${x.days_granted}日・残${x.days_remaining}日（${x.grant_reason}）`;
  });

  const todayJst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const futureGrant = (grantRows ?? []).find((g) => {
    const gd = (g as { grant_date: string }).grant_date;
    return gd > todayJst;
  }) as { grant_date: string } | undefined;
  const nextGrantFromGrants = futureGrant?.grant_date ?? "—";

  const { data: contractRow } = await supabase
    .from("employment_contracts")
    .select(
      "base_salary, deemed_overtime_hours, deemed_overtime_amount, commute_allowance_monthly, commute_route, work_hours_per_day, work_days_per_week, hire_date, start_date",
    )
    .eq("employee_id", p.id)
    .maybeSingle();
  const contract = contractRow as {
    base_salary?: number | null;
    deemed_overtime_hours?: number | null;
    deemed_overtime_amount?: number | null;
    commute_allowance_monthly?: number | null;
    commute_route?: string | null;
    work_hours_per_day?: number | null;
    work_days_per_week?: number | null;
    hire_date?: string | null;
    start_date?: string | null;
  } | null;

  const { startIso, endIso, label: attendanceMonthLabel } = jstMonthBounds();
  const { data: punchRows } = await supabase
    .from("attendance_punches")
    .select("punched_at, punch_type")
    .eq("user_id", userId)
    .gte("punched_at", startIso)
    .lte("punched_at", endIso)
    .order("punched_at", { ascending: true });
  const attendanceLine = attendanceSummaryFromPunches(
    (punchRows ?? []) as { punched_at: string; punch_type: string }[],
    attendanceMonthLabel,
  );

  const joinedHint =
    contract?.start_date ??
    contract?.hire_date ??
    p.created_at?.slice(0, 10) ??
    "—";
  const contractPart = contract
    ? [
        `基本給（月）: ${contract.base_salary != null ? `${Number(contract.base_salary).toLocaleString("ja-JP")}円` : "—"}`,
        `みなし残業: ${contract.deemed_overtime_hours ?? "—"}時間 / ${contract.deemed_overtime_amount != null ? `${Number(contract.deemed_overtime_amount).toLocaleString("ja-JP")}円` : "—"}`,
        `通勤手当: ${contract.commute_allowance_monthly != null ? `${Number(contract.commute_allowance_monthly).toLocaleString("ja-JP")}円` : "—"}（経路: ${contract.commute_route?.trim() || "—"}）`,
        `所定: ${contract.work_hours_per_day ?? "—"}時間/日・${contract.work_days_per_week ?? "—"}日/週`,
      ].join("、")
    : "雇用契約レコードなし（未登録の可能性）";

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

  const docsWithSummary = (companyDocs ?? []).filter((d) => {
    const s = (d as { ai_summary?: string | null }).ai_summary;
    return s != null && String(s).trim().length > 0;
  }) as { name: string; ai_summary: string }[];

  const rulesFromPdf =
    docsWithSummary.length > 0
      ? `## 会社の就業規則・社内規定
以下は${companyName}の就業規則です。従業員からの質問には必ずこの規則に基づいて回答してください。
規則に記載のない事項は「就業規則に明記されていませんが、一般的には〜」と補足してください。

${docsWithSummary.map((d) => `### ${d.name}\n${d.ai_summary}`).join("\n\n")}`
      : "";

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
    rulesFromPdf.trim().length > 0 ? `\n\n${rulesFromPdf}` : "";

  return `あなたは${companyName}の専任AI人事アシスタントです。
【企業理念・ミッション】
- 企業理念：感動創造
- ミッション：最先端の美容技術で世界No.1に、多くのお客様の幸せに貢献する
- お客様の成功は私たちの成功
- 社員の成長こそが企業の成功
- お客様の成功に貢献するために行動の質と量を高める
- 結果として達成・成長があり、社員の自己実現につながる

【相談対応の方針】
- 就業規則・社内規定に基づいて回答する
- 企業理念「感動創造」の精神で、社員の成長・自己実現を支援する
- ポジティブで前向きなアドバイスを心がける
- 社員が行動の質と量を高められるよう具体的なアドバイスをする

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
- 入社日（契約の入社日・雇用開始、なければ人事レコード作成日）: ${joinedHint}
- 雇用区分: 契約社員相当=${p.is_contract ? "はい" : "いいえ"}、短時間勤務=${p.is_part_time ? "はい" : "いいえ"}
- 雇用契約（employment_contracts）: ${contractPart}
- 有給残（paid_leave_balances）: ${leave?.days_remaining != null ? `${leave.days_remaining} 日` : "不明"}（次回付与目安 ${leave?.next_accrual_date ?? "—"}${leave?.next_accrual_days != null ? `、付与日数 ${leave.next_accrual_days}` : ""}）
- 有給付与履歴（paid_leave_grants・抜粋）: ${grantsLines.length ? grantsLines.join(" ／ ") : "なし"}（表中の将来付与日の一例: ${nextGrantFromGrants}）
- 今月の勤怠（attendance_punches・概算）: ${attendanceLine}
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
