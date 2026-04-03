import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSalesTargetUserIds } from "@/lib/employee-sales-target";
import {
  hasDealKeywords,
  parseDealCountFromPurpose,
  parseNightsFromPurpose,
} from "@/lib/expense-audit-purpose-parse";
import type { ExpenseAuditInput, ExpenseAuditIssue } from "@/types/expense-audit";

function isEntertainmentCategory(category: string) {
  return category.includes("接待") || category.includes("交際");
}

function addDaysIso(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function isHotelCategory(category: string) {
  return category.includes("宿泊") || category.includes("ホテル");
}

function isTravelTransport(category: string) {
  return (
    category === "交通費" ||
    category.includes("交通") ||
    category.includes("出張")
  );
}

function looksLikeRental(vendor: string, purpose: string) {
  return /レンタカ|レンタカー|カーレンタル|レンタル車/i.test(`${vendor}\n${purpose}`);
}

const URBAN_HINT =
  /東京|大阪|名古屋|福岡|横浜|札幌|仙台|広島|京都|神戸|渋谷|新宿|池袋|梅田|博多|天神|銀座|品川/i;

/** meal: 'breakfast' | 'lunch' | 'dinner' | null */
function detectMealSlot(purpose: string, category: string): string | null {
  if (isEntertainmentCategory(category)) return null;
  const t = `${category}\n${purpose}`;
  if (/朝食|モーニング|ビュッフェ.*朝/i.test(t)) return "breakfast";
  if (/昼食|ランチ|弁当/i.test(t)) return "lunch";
  if (/夕食|ディナー|会食|食事(?!.*接待)/i.test(t)) return "dinner";
  return null;
}

export async function appendExtendedCategoryRules(
  supabase: SupabaseClient,
  input: ExpenseAuditInput,
  issues: ExpenseAuditIssue[],
): Promise<void> {
  const amount = Number(input.amount);
  const vendor = String(input.vendor ?? "");
  const purpose = String(input.purpose ?? "");
  const category = String(input.category ?? "");
  const paidDate = String(input.paid_date ?? "");

  /* ---------- ホテル・宿泊（1泊単価レンジ） ---------- */
  if (isHotelCategory(category) && amount > 0) {
    const purposeHasNightsHint = /\d+\s*泊|宿泊|連泊/i.test(purpose);
    let nights = parseNightsFromPurpose(purpose);
    if (nights == null) {
      nights = Math.max(1, Math.round(amount / 8000));
      if (!purposeHasNightsHint) {
        issues.push({
          type: "hotel_nights_missing",
          severity: "warning",
          message: "宿泊日数と出張目的を記載してください（確認事項）。",
        });
      }
    }
    const n = Math.max(1, nights);
    const perNight = amount / n;
    const refBiz = 8000;
    const savingToBizHotel = Math.max(0, Math.round(amount - refBiz * n));

    if (perNight < 8000) {
      issues.push({
        type: "hotel_rate",
        severity: "info",
        message: `1泊あたり約 ¥${Math.round(perNight).toLocaleString("ja-JP")} で承認推奨に見えます。`,
      });
    } else if (perNight < 15000) {
      issues.push({
        type: "hotel_rate_standard",
        severity: "info",
        message: `1泊あたり約 ¥${Math.round(perNight).toLocaleString("ja-JP")} です。標準的な宿泊費です。`,
      });
    } else if (perNight < 25000) {
      issues.push({
        type: "hotel_rate_somewhat_high",
        severity: "warning",
        message:
          "やや高額です。出張規定内か確認してください（確認事項）。",
        saving_amount: savingToBizHotel > 0 ? savingToBizHotel : undefined,
      });
    } else {
      issues.push({
        type: "hotel_rate_excessive",
        severity: "warning",
        message: `高額宿泊です。承認者確認を推奨します。近隣のビジネスホテル（目安1泊¥${refBiz.toLocaleString("ja-JP")}）に変更した場合の削減目安: 約 ¥${savingToBizHotel.toLocaleString("ja-JP")}（確認事項）。`,
        saving_amount: savingToBizHotel,
      });
    }

    try {
      const d = new Date(`${paidDate}T12:00:00`);
      const w = d.getDay();
      if (w === 0 || w === 6) {
        issues.push({
          type: "hotel_weekend",
          severity: "warning",
          message:
            "週末（土日）の宿泊です。業務上の必要性を確認してください（確認事項）。",
        });
      }
    } catch {
      /* noop */
    }

    if (input.submitter_id && input.company_id && paidDate) {
      const t0 = addDaysIso(paidDate, -7);
      const t1 = addDaysIso(paidDate, 7);
      const { data: nearRows } = await supabase
        .from("expenses")
        .select("category")
        .eq("submitter_id", input.submitter_id)
        .eq("company_id", input.company_id)
        .gte("paid_date", t0)
        .lte("paid_date", t1);
      const hasTransport = (nearRows ?? []).some((r) => {
        const c = (r as { category: string }).category;
        return (
          c === "交通費" || c.includes("交通") || c.includes("出張") || c.includes("タクシ")
        );
      });
      if (!hasTransport) {
        issues.push({
          type: "hotel_no_transport",
          severity: "info",
          message:
            "宿泊を伴う出張の場合、交通費の申請も必要ではないですか？（確認事項）",
        });
      }
    }
  }

  /* ---------- レンタカー（同日のガソリン・高速を合算） ---------- */
  if (looksLikeRental(vendor, purpose) && amount > 0) {
    const dayM = purpose.match(/(\d+)\s*日/);
    const days = dayM ? Math.max(1, Number(dayM[1])) : 1;
    let totalForDaily = amount;
    let combinedNote = "";
    if (input.submitter_id && input.company_id && paidDate) {
      const { data: sdRows } = await supabase
        .from("expenses")
        .select("id, amount, purpose")
        .eq("submitter_id", input.submitter_id)
        .eq("company_id", input.company_id)
        .eq("paid_date", paidDate);
      for (const r of sdRows ?? []) {
        const rid = (r as { id?: string }).id;
        if (input.id && rid === input.id) continue;
        const p = String((r as { purpose: string }).purpose ?? "");
        if (/ガソリン|給油|燃料|高速|ＥＴＣ|ETC|通行料/i.test(p)) {
          totalForDaily += Number((r as { amount: number }).amount);
          combinedNote = "（同日のガソリン・高速等を合算した日額で評価）";
        }
      }
    }
    const daily = totalForDaily / days;
    if (daily < 8000) {
      issues.push({
        type: "rental_daily",
        severity: "info",
        message: `日額約 ¥${Math.round(daily).toLocaleString("ja-JP")} で承認推奨に見えます。${combinedNote}`,
      });
    } else {
      const saving = Math.max(3500, Math.round(daily * 0.22 * days));
      issues.push({
        type: "rental_daily_high",
        severity: "warning",
        message: `日額約 ¥${Math.round(daily).toLocaleString("ja-JP")} です。電車・バスでの移動と比較してください（確認事項）。レンタカー→電車+タクシーに変えた場合の削減目安: 約 ¥${saving.toLocaleString("ja-JP")}。${combinedNote}`,
        saving_amount: saving,
      });
    }
    const dest = `${purpose}\n${input.to_location ?? ""}`;
    if (URBAN_HINT.test(dest)) {
      issues.push({
        type: "rental_urban",
        severity: "info",
        message:
          "目的地が都市部のため、公共交通機関が効率的です。駐車場代も含めると割高になる場合があります（確認事項）。",
      });
    } else if (/地方|郊外|県道|山間|離島|ロング/i.test(dest)) {
      issues.push({
        type: "rental_rural_ok",
        severity: "info",
        message:
          "地方・郊外の移動ではレンタカーが合理的と判断しやすい水準です。",
      });
    }

    if (/ガソリン|給油|燃料|油種/i.test(purpose)) {
      issues.push({
        type: "rental_gas",
        severity: "info",
        message:
          "ガソリン代が別途申請されている場合は、レンタカー料金と合算して審査してください（確認事項）。",
      });
    }
    if (/高速|ＥＴＣ|ETC|通行料/i.test(purpose)) {
      issues.push({
        type: "rental_toll",
        severity: "info",
        message:
          "高速道路代が別途申請されている場合は合算して妥当性を確認してください（確認事項）。",
      });
    }
  }

  /* ---------- 飲食（接待以外） ---------- */
  const slot = detectMealSlot(purpose, category);
  if (slot && !isEntertainmentCategory(category)) {
    if (slot === "breakfast") {
      if (amount <= 1500) {
        issues.push({
          type: "meal_breakfast",
          severity: "info",
          message: "朝食 ¥1,500以下のため承認推奨に見えます。",
        });
      } else {
        issues.push({
          type: "meal_breakfast_high",
          severity: "warning",
          message: "朝食としては高額です（確認事項）。",
        });
      }
    } else if (slot === "lunch") {
      if (amount <= 2000) {
        issues.push({
          type: "meal_lunch",
          severity: "info",
          message: "昼食（単独）¥2,000以下のため承認推奨に見えます。",
        });
      } else {
        issues.push({
          type: "meal_lunch_high",
          severity: "warning",
          message:
            "社内規定の昼食補助範囲を超えています（確認事項）。",
        });
      }
    } else if (slot === "dinner") {
      if (amount <= 3000) {
        issues.push({
          type: "meal_dinner",
          severity: "info",
          message: "夕食（接待なし・単独）¥3,000以下のため承認推奨に見えます。",
        });
      } else {
        issues.push({
          type: "meal_dinner_high",
          severity: "warning",
          message:
            "個人の夕食費としては高額です。接待の場合は参加者を記載してください（確認事項）。",
        });
      }
    }
    if (/居酒屋|バー|BAR|酒場/i.test(purpose)) {
      issues.push({
        type: "meal_alcohol",
        severity: "warning",
        message:
          "アルコールを含む可能性があります。アルコール代が含まれる場合、会社規定を確認してください（確認事項）。",
      });
    }
    const lateByPurpose = /深夜|2[2-3]時以降|2[2-3]時\b|23時|24時|午後1[01]時/i.test(
      purpose,
    );
    const h = input.ride_hour_local;
    if (lateByPurpose || (h != null && h >= 22)) {
      issues.push({
        type: "meal_late",
        severity: "warning",
        message:
          "深夜（22時以降）の飲食費です。業務上の必要性を記載してください（確認事項）。",
      });
    }
  }

  /* ---------- 消耗品・買い物 ---------- */
  if (category.includes("消耗品")) {
    if (amount < 3000) {
      issues.push({
        type: "supplies_low",
        severity: "info",
        message: "¥3,000未満の消耗品のため承認推奨に見えます。",
      });
    } else if (amount < 10000) {
      issues.push({
        type: "supplies_mid",
        severity: "warning",
        message:
          "購入品の詳細と業務上の必要性を記載してください（確認事項）。",
      });
    } else {
      issues.push({
        type: "supplies_high",
        severity: "warning",
        message:
          "高額な消耗品です。事前承認が必要な場合があります（確認事項）。",
      });
    }
    const generic =
      /^消耗品$|^(備品|雑費)$/i.test(purpose.trim()) || purpose.trim().length < 6;
    if (generic) {
      issues.push({
        type: "supplies_vague",
        severity: "warning",
        message:
          "購入品の具体的な品名を記載してください（確認事項）。",
      });
    }
    if (/Amazon|アマゾン|ビックカメラ|ヨドバシ|家電量販/i.test(vendor + purpose)) {
      issues.push({
        type: "supplies_vendor",
        severity: "info",
        message:
          "購入品の業務利用目的を明記してください（確認事項）。",
      });
    }
    if (/食品|飲料|菓子|おにぎり|弁当|水\b/i.test(purpose) && !slot) {
      issues.push({
        type: "supplies_food",
        severity: "info",
        message:
          "食品・飲料は会議費または接待費として申請してください（確認事項）。",
      });
    }
  }

  /* ---------- 書籍・研修 ---------- */
  if (category.includes("書籍") || category.includes("研修")) {
    if (amount < 5000) {
      issues.push({
        type: "training_low",
        severity: "info",
        message: "¥5,000未満の書籍・研修のため承認推奨に見えます。",
      });
    } else if (amount < 30000) {
      issues.push({
        type: "training_mid",
        severity: "warning",
        message:
          "研修内容と業務関連性を記載してください（確認事項）。",
      });
    } else {
      issues.push({
        type: "training_high",
        severity: "warning",
        message:
          "高額な研修費です。事前承認済みか確認してください（確認事項）。",
      });
    }
    if (!/書籍|本|研修|セミナー|講座|eラーニング|タイトル|コース/i.test(purpose)) {
      issues.push({
        type: "training_name",
        severity: "warning",
        message: "書籍名または研修名を記載してください（確認事項）。",
      });
    }
  }

  /* ---------- 通信費 ---------- */
  if (category.includes("通信")) {
    if (amount <= 5000) {
      issues.push({
        type: "comm_low",
        severity: "info",
        message: "月額 ¥5,000以下のため承認推奨に見えます。",
      });
    } else if (amount <= 15000) {
      issues.push({
        type: "comm_mid",
        severity: "warning",
        message:
          "月額 ¥5,000〜¥15,000 帯です。業務用回線のプラン・契約条件を確認してください（確認事項）。",
      });
    } else {
      const saving = Math.round(amount * 0.2);
      issues.push({
        type: "comm_high",
        severity: "warning",
        message: `月額 ¥15,000超の高額な通信費です。プラン見直しで削減できる可能性があります（目安 ¥${saving.toLocaleString("ja-JP")}/月）（確認事項）。`,
        saving_amount: saving,
      });
    }
    if (/スマホ|携帯|個人|SoftBank|docomo|au|UQ|楽天モバイル/i.test(purpose)) {
      issues.push({
        type: "comm_personal",
        severity: "info",
        message:
          "個人スマホの通信費と見えます。個人回線の場合、業務使用割合（例: 50%）を記載してください（確認事項）。",
      });
    }
  }

  /* ---------- 広告宣伝 ---------- */
  if (category.includes("広告") || category.includes("宣伝")) {
    if (amount < 50000) {
      issues.push({
        type: "ad_mid",
        severity: "info",
        message:
          "¥50,000未満の広告宣伝費です。媒体・目的の補足があると確認しやすいです（確認推奨）。",
      });
    } else {
      issues.push({
        type: "ad_high",
        severity: "warning",
        message:
          "高額な広告費です。効果測定の指標を記載してください（確認事項）。",
      });
    }
    if (!/媒体|キャンペーン|CM|バナー|SNS|Facebook|Instagram|Google/i.test(purpose)) {
      issues.push({
        type: "ad_detail",
        severity: "warning",
        message:
          "広告媒体名とキャンペーン目的を記載してください（確認事項）。",
      });
    }
    if (/Meta|Facebook|Instagram|Google\s*広告|Google\s*Ads|LINE\s*広告/i.test(purpose)) {
      issues.push({
        type: "ad_platform",
        severity: "info",
        message:
          "広告アカウントのレポートを添付することを推奨します（確認事項）。",
      });
    }
  }
}

export async function appendCompositeRules(
  supabase: SupabaseClient,
  input: ExpenseAuditInput,
  issues: ExpenseAuditIssue[],
): Promise<void> {
  const paidDate = String(input.paid_date ?? "");
  const submitterId = input.submitter_id;
  const companyId = input.company_id;
  if (!submitterId || !companyId || !paidDate) return;

  const { data: sameDayAmounts } = await supabase
    .from("expenses")
    .select("amount, id")
    .eq("submitter_id", submitterId)
    .eq("company_id", companyId)
    .eq("paid_date", paidDate);
  const rows = sameDayAmounts ?? [];
  let sum = 0;
  for (const r of rows) {
    sum += Number((r as { amount: number }).amount);
  }
  if (!input.id) sum += Number(input.amount);
  const lineCount = rows.length + (input.id ? 0 : 1);
  if (lineCount >= 2 && sum >= 50000) {
    issues.push({
      type: "same_day_high_total",
      severity: "warning",
      message: `同一日に¥50,000以上の複数申請があります（合計目安 ¥${Math.round(sum).toLocaleString("ja-JP")}）。まとめて事前承認を取ることを推奨します（確認事項）。`,
    });
  }

  try {
    const [y, mo, da] = paidDate.split("-").map(Number);
    const day = new Date(y, mo - 1, da).getDate();
    if (day >= 25 || day <= 5) {
      issues.push({
        type: "month_boundary",
        severity: "info",
        message:
          "月末・月初の集中申請です。月中の申請を推奨します（確認事項）。",
      });
    }
  } catch {
    /* noop */
  }

  if (input.created_at) {
    const pd = new Date(`${paidDate}T12:00:00`);
    const cr = new Date(input.created_at);
    const daysAfterPay = (cr.getTime() - pd.getTime()) / 86400000;
    if (daysAfterPay >= 30) {
      issues.push({
        type: "late_application",
        severity: "warning",
        message:
          "申請日と支払日の差が30日以上です。支払いから申請まで時間が経過しています。速やかな申請をお願いします（確認事項）。",
      });
    }
  }

  /* 連続日付の出張らしき申請（交通・宿泊・出張） */
  const pad = (n: number) => String(n).padStart(2, "0");
  const [yy, mm] = paidDate.split("-").map(Number);
  if (Number.isFinite(yy) && Number.isFinite(mm)) {
    const lastD = new Date(yy, mm, 0).getDate();
    const start = `${yy}-${pad(mm)}-01`;
    const end = `${yy}-${pad(mm)}-${pad(lastD)}`;
    const { data: monthExp } = await supabase
      .from("expenses")
      .select("paid_date, category")
      .eq("submitter_id", submitterId)
      .eq("company_id", companyId)
      .gte("paid_date", start)
      .lte("paid_date", end);
    const travelish = new Set<string>();
    for (const r of monthExp ?? []) {
      const c = (r as { category: string }).category;
      if (
        c.includes("交通") ||
        c.includes("宿泊") ||
        c.includes("出張")
      ) {
        travelish.add((r as { paid_date: string }).paid_date);
      }
    }
    const sorted = [...travelish].sort();
    let run = 1;
    let best = 1;
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(`${sorted[i - 1]}T12:00:00`);
      const b = new Date(`${sorted[i]}T12:00:00`);
      if ((b.getTime() - a.getTime()) / 86400000 <= 1) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 1;
      }
    }
    const cat = input.category;
    const travelStreakApplies =
      isTravelTransport(cat) ||
      isHotelCategory(cat) ||
      /飲食|食事|会議費|接待|交際/i.test(cat);
    if (best >= 3 && travelStreakApplies) {
      issues.push({
        type: "consecutive_travel",
        severity: "info",
        message:
          "連続する出張（3日以上）に関係する申請があります。宿泊費・交通費・飲食費を合算して妥当性を確認してください（確認事項）。",
      });
    }
  }
}

function isTransportCatAudit(c: string) {
  return c === "交通費" || c.includes("交通");
}

/** 自社の他営業（同一月）の「交通費 ÷ 推定商談件数」の平均（申請者自身は除く） */
async function peerAvgTransportCostPerDeal(
  supabase: SupabaseClient,
  companyId: string,
  excludeUserId: string,
  y: number,
  mo: number,
): Promise<number> {
  const peers = (await fetchSalesTargetUserIds(supabase, companyId)).filter(
    (id) => id !== excludeUserId,
  );
  if (peers.length === 0) return 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = new Date(y, mo, 0).getDate();
  const startD = `${y}-${pad(mo)}-01`;
  const endD = `${y}-${pad(mo)}-${String(end).padStart(2, "0")}`;
  const ratios: number[] = [];

  for (const sid of peers) {
    const { data: tr } = await supabase
      .from("expenses")
      .select("amount, purpose, category")
      .eq("submitter_id", sid)
      .eq("company_id", companyId)
      .gte("paid_date", startD)
      .lte("paid_date", endD);
    let transportSum = 0;
    let sumPurpose = 0;
    for (const r of tr ?? []) {
      const c = (r as { category: string }).category;
      if (isTransportCatAudit(c)) transportSum += Number((r as { amount: number }).amount);
      const pc = parseDealCountFromPurpose(String((r as { purpose: string }).purpose));
      if (pc != null) sumPurpose += pc;
    }
    const { data: arRows } = await supabase
      .from("activity_reports")
      .select("meeting_count, visit_count")
      .eq("employee_id", sid)
      .eq("company_id", companyId)
      .gte("report_date", startD)
      .lte("report_date", endD);
    let arM = 0;
    let arV = 0;
    for (const rep of arRows ?? []) {
      arM += Number((rep as { meeting_count: number }).meeting_count ?? 0);
      arV += Number((rep as { visit_count: number }).visit_count ?? 0);
    }
    const td = Math.max(1, sumPurpose, arM + arV);
    if (transportSum > 0) ratios.push(transportSum / td);
  }

  if (ratios.length === 0) return 0;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export async function appendSalesLinkedRules(
  supabase: SupabaseClient,
  input: ExpenseAuditInput,
  issues: ExpenseAuditIssue[],
): Promise<void> {
  if (!input.is_sales_target) return;

  const purpose = String(input.purpose ?? "");
  const category = String(input.category ?? "");
  const amount = Number(input.amount);
  const paidDate = String(input.paid_date ?? "");

  const parsed = parseDealCountFromPurpose(purpose);
  const fromAr =
    (input.activity_meeting_count ?? 0) + (input.activity_visit_count ?? 0);
  const dealCount = Math.max(parsed ?? 0, fromAr);
  const uncertain =
    (parsed == null || parsed === 0) &&
    fromAr === 0 &&
    hasDealKeywords(purpose);

  const nights = parseNightsFromPurpose(purpose);
  const lodging = isHotelCategory(category);
  const transportOnly =
    isTravelTransport(category) && !lodging && !looksLikeRental(input.vendor, purpose);

  if (uncertain) {
    issues.push({
      type: "sales_deal_parse",
      severity: "info",
      message:
        "商談・訪問の記載はありますが件数が読み取れませんでした。件数を明記するか、商談情報欄に入力してください（AI 補助確認推奨）。",
      needs_ai_parse: true,
    });
  }

  if (transportOnly && amount >= 5000) {
    if (dealCount >= 1) {
      issues.push({
        type: "sales_daytrip_ok",
        severity: "info",
        message:
          "日帰り移動に対し商談・訪問の記載があります（確認事項）。",
      });
    } else if (!uncertain) {
      issues.push({
        type: "sales_daytrip_missing",
        severity: "warning",
        message:
          "訪問先と商談件数を記載してください（確認事項）。",
      });
    }
  }

  if (lodging && amount > 0) {
    const n = nights ?? Math.max(1, Math.round(amount / 7000));
    if (n === 1) {
      if (dealCount >= 2) {
        issues.push({
          type: "sales_1night_ok",
          severity: "info",
          message: "1泊出張で商談件数が複数あるため効率面は許容しやすい水準です。",
        });
      } else if (dealCount === 1) {
        const saving = Math.round(amount * 0.35);
        issues.push({
          type: "sales_1night_low",
          severity: "warning",
          message: `1件の商談のための宿泊です。日帰りの可能性を確認してください。目安 ¥${saving.toLocaleString("ja-JP")} の削減余地（確認事項）。`,
          saving_amount: saving,
        });
      } else if (!uncertain) {
        issues.push({
          type: "sales_1night_zero",
          severity: "error",
          message:
            "宿泊を伴う出張の場合、商談件数（3件以上推奨）を記載してください（確認事項）。",
        });
      }
    } else if (n >= 2) {
      if (dealCount >= 3) {
        issues.push({
          type: "sales_multinight_ok",
          severity: "info",
          message:
            "複数泊出張に対し商談件数が3件以上あり、成果連動の観点では承認推奨に見えます。",
        });
      } else if (dealCount >= 1) {
        issues.push({
          type: "sales_multinight_low",
          severity: "warning",
          message:
            "複数泊の出張に対して商談件数が少ない可能性があります。商談3件以上を推奨します（確認事項）。",
        });
      } else if (!uncertain) {
        issues.push({
          type: "sales_multinight_zero",
          severity: "error",
          message:
            "出張の成果（商談件数・訪問先）を必ず記載してください（確認事項）。",
        });
      }
    }
  }

  /* 月間交通費 3万以上 → 商談あたり効率 */
  const submitterId = input.submitter_id;
  const companyId = input.company_id;
  if (submitterId && companyId && paidDate) {
    const [y, mo] = paidDate.split("-").map(Number);
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const end = new Date(y, mo, 0).getDate();

      const { data: tr } = await supabase
        .from("expenses")
        .select("amount, purpose, category")
        .eq("submitter_id", submitterId)
        .eq("company_id", companyId)
        .gte("paid_date", `${y}-${pad(mo)}-01`)
        .lte("paid_date", `${y}-${pad(mo)}-${String(end).padStart(2, "0")}`);
      let transportSum = 0;
      let sumPurposeDeals = 0;
      for (const r of tr ?? []) {
        const c = (r as { category: string }).category;
        if (isTransportCatAudit(c)) {
          transportSum += Number((r as { amount: number }).amount);
        }
        const p = String((r as { purpose: string }).purpose);
        const pc = parseDealCountFromPurpose(p);
        if (pc != null) sumPurposeDeals += pc;
      }
      const { data: reps } = await supabase
        .from("activity_reports")
        .select("meeting_count, visit_count")
        .eq("employee_id", submitterId)
        .eq("company_id", companyId)
        .gte("report_date", `${y}-${pad(mo)}-01`)
        .lte("report_date", `${y}-${pad(mo)}-${String(end).padStart(2, "0")}`);
      let arMeet = 0;
      let arVisit = 0;
      for (const rep of reps ?? []) {
        arMeet += Number((rep as { meeting_count: number }).meeting_count ?? 0);
        arVisit += Number((rep as { visit_count: number }).visit_count ?? 0);
      }
      const arActivity = arMeet + arVisit;
      const totalDealsTransport = Math.max(1, sumPurposeDeals, arActivity);
      const totalDealsLodging = Math.max(1, sumPurposeDeals, arMeet, arVisit);
      if (transportSum >= 30000) {
        const per = transportSum / totalDealsTransport;
        if (per <= 10000) {
          issues.push({
            type: "sales_month_transport_eff_ok",
            severity: "info",
            message: `今月の交通費に対する商談換算効率はおおよそ ¥${Math.round(per).toLocaleString("ja-JP")}/件です。`,
          });
        } else if (per <= 20000) {
          issues.push({
            type: "sales_month_transport_eff_mid",
            severity: "warning",
            message:
              "商談効率を確認してください。移動の最適化で削減できる可能性があります（確認事項）。",
          });
        } else {
          issues.push({
            type: "sales_month_transport_eff_bad",
            severity: "warning",
            message:
              "商談1件あたりの移動コストが高額に見えます。オンライン商談の活用を検討してください（確認事項）。",
          });
        }

        const teamAvg = await peerAvgTransportCostPerDeal(
          supabase,
          companyId,
          submitterId,
          y,
          mo,
        );
        if (teamAvg > 0 && per > teamAvg * 1.12) {
          issues.push({
            type: "sales_vs_team_transport",
            severity: "info",
            message: `今月の商談1件あたりの移動コストは ¥${Math.round(per).toLocaleString("ja-JP")} です。チーム平均 ¥${Math.round(teamAvg).toLocaleString("ja-JP")} と比較してやや高めです（確認事項）。`,
          });
        }
      }

      let lodgingSum = 0;
      for (const r of tr ?? []) {
        const c = (r as { category: string }).category;
        if (c.includes("宿泊")) lodgingSum += Number((r as { amount: number }).amount);
      }
      if (lodgingSum >= 50000) {
        if (totalDealsLodging >= 5) {
          issues.push({
            type: "sales_lodging_eff_ok",
            severity: "info",
            message: "月間宿泊費に対し商談・訪問の件数は十分に見えます。",
          });
        } else if (totalDealsLodging >= 3) {
          issues.push({
            type: "sales_lodging_eff_mid",
            severity: "warning",
            message:
              "宿泊費に対して商談件数を増やすことで効率が上がります（確認事項）。",
          });
        } else {
          issues.push({
            type: "sales_lodging_eff_bad",
            severity: "warning",
            message:
              "宿泊を伴う出張が多い割に商談件数が少ない状態です。商談のスケジューリングを改善してください（確認事項）。",
          });
        }
      }
    }
  }
}
