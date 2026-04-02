import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendCompositeRules,
  appendExtendedCategoryRules,
  appendSalesLinkedRules,
} from "@/lib/expense-audit-extra";
import { fetchTransitDurationSeconds } from "@/lib/expense-audit-google";
import type { ExpenseAuditInput, ExpenseAuditIssue } from "@/types/expense-audit";

export type { ExpenseAuditInput } from "@/types/expense-audit";

function looksLikeTaxi(vendor: string, purpose: string) {
  return /タクシ|ｔａｘｉ|TAXI/i.test(`${vendor}\n${purpose}`);
}

function isTransportCategory(category: string) {
  return category === "交通費" || category.includes("交通");
}

export function isEntertainmentCategory(category: string) {
  return category.includes("接待") || category.includes("交際");
}

function parseAttendeesCount(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d+)\s*名/);
  if (m) return Math.max(1, Number(m[1]));
  const parts = s.split(/[,、，\s]+/).filter(Boolean);
  if (parts.length >= 1) return Math.max(1, parts.length);
  return 1;
}

function paidDateToHourFallback(paidDate: string): number | null {
  // 支払日のみのため時刻なし — ルール説明用に null を返す
  void paidDate;
  return null;
}

function lastDay(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export async function runExpenseAuditRules(
  supabase: SupabaseClient,
  input: ExpenseAuditInput,
): Promise<ExpenseAuditIssue[]> {
  const issues: ExpenseAuditIssue[] = [];
  const amount = Number(input.amount);
  const vendor = String(input.vendor ?? "");
  const purpose = String(input.purpose ?? "");
  const category = String(input.category ?? "");
  const paidDate = String(input.paid_date ?? "");

  if (purpose.trim().length > 0 && purpose.trim().length < 10) {
    issues.push({
      type: "purpose_short",
      severity: "warning",
      message: "用途の説明が不十分です。確認事項として詳細を記載してください。",
    });
  }

  if (!input.receipt_url?.trim()) {
    issues.push({
      type: "receipt_missing",
      severity: "info",
      message:
        "領収書が添付されていません。3万円未満でも添付を推奨します（確認事項）。",
    });
  }

  const taxi = looksLikeTaxi(vendor, purpose) && isTransportCategory(category);
  const hour =
    input.ride_hour_local != null &&
    Number.isFinite(input.ride_hour_local) &&
    input.ride_hour_local >= 0 &&
    input.ride_hour_local <= 23
      ? Math.floor(input.ride_hour_local)
      : paidDateToHourFallback(paidDate);

  if (taxi) {
    if (amount > 0 && amount < 1000) {
      issues.push({
        type: "taxi_short_haul",
        severity: "info",
        message:
          "タクシー利用の金額が少額のため、徒歩または公共交通機関で移動可能な距離の可能性があります（確認事項）。",
        saving_amount: Math.max(0, Math.round(amount * 0.85)),
      });
    }
    if (hour != null) {
      if (hour >= 22 || hour < 5) {
        // 深夜帯は許容コメントは出さない
      } else if (hour >= 9 && hour < 20 && amount >= 3000) {
        issues.push({
          type: "taxi_daytime_high",
          severity: "warning",
          message:
            "日中のタクシーで金額が大きめです。公共交通機関との比較を確認してください（確認事項）。",
        });
      }
    } else if (amount >= 3000) {
      issues.push({
        type: "taxi_time_unknown",
        severity: "info",
        message:
          "利用時刻が日単位のみのため日中/深夜の区分ができません。公共交通との比較を確認してください（確認事項）。",
      });
    }
  }

  const from = String(input.from_location ?? "").trim();
  const to = String(input.to_location ?? "").trim();
  if (from && to && isTransportCategory(category) && amount > 0) {
    const sec = await fetchTransitDurationSeconds(from, to);
    if (sec != null && sec <= 30 * 60) {
      const trainEst = 500;
      const saving = Math.max(0, Math.round(amount - trainEst));
      issues.push({
        type: "transit_preferred",
        severity: "warning",
        message: `公共交通機関利用を推奨します（所要おおよそ ${Math.round(sec / 60)} 分以内の想定）。`,
        saving_amount: saving,
      });
    }
  }

  if (isEntertainmentCategory(category)) {
    const n = parseAttendeesCount(input.attendees ?? null);
    if (n == null) {
      issues.push({
        type: "entertainment_attendees",
        severity: "error",
        message:
          "参加者の記載がありません。接待交際費の場合は必須です（確認事項）。",
      });
    } else {
      const per = amount / n;
      if (per < 5000) {
        issues.push({
          type: "entertainment_per_head",
          severity: "info",
          message: `1人あたり約 ¥${Math.round(per).toLocaleString("ja-JP")} であり、承認観点では大きな懸念は少ない想定です。`,
        });
      } else if (per < 15000) {
        issues.push({
          type: "entertainment_per_head",
          severity: "warning",
          message:
            "1人あたり金額が中程度です。目的・効果の記載を確認してください（確認事項）。",
        });
      } else {
        issues.push({
          type: "entertainment_per_head_high",
          severity: "error",
          message:
            "高額接待に該当しうる金額です。承認者による確認を推奨します（確認事項）。",
        });
      }
    }
  }

  const submitterId = input.submitter_id;
  const companyId = input.company_id;
  if (submitterId && paidDate && companyId) {
    let q = supabase
      .from("expenses")
      .select("id")
      .eq("submitter_id", submitterId)
      .eq("company_id", companyId)
      .eq("paid_date", paidDate)
      .eq("category", category);
    if (input.id) q = q.neq("id", input.id);
    const { data: sameDay } = await q;
    if (sameDay && sameDay.length > 0) {
      issues.push({
        type: "duplicate_same_day",
        severity: "info",
        message:
          "同一日・同一カテゴリで複数申請があります。まとめて申請できる可能性があります（確認事項）。",
      });
    }
  }

  if (submitterId && paidDate && companyId && isTransportCategory(category)) {
    const [y, mo] = paidDate.split("-").map(Number);
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      const prevM = mo === 1 ? 12 : mo - 1;
      const prevY = mo === 1 ? y - 1 : y;
      const pad = (n: number) => String(n).padStart(2, "0");
      const end = (yy: number, mm: number) => lastDay(yy, mm);
      const transportCategories = ["交通費", "出張費（交通）"];
      const sumRange = async (yy: number, mm: number) => {
        const { data } = await supabase
          .from("expenses")
          .select("amount")
          .eq("submitter_id", submitterId)
          .eq("company_id", companyId)
          .in("category", transportCategories)
          .gte("paid_date", `${yy}-${pad(mm)}-01`)
          .lte(
            "paid_date",
            `${yy}-${pad(mm)}-${String(end(yy, mm)).padStart(2, "0")}`,
          );
        return (data ?? []).reduce(
          (a, r) => a + Number((r as { amount: number }).amount),
          0,
        );
      };
      const cur = await sumRange(y, mo);
      const prev = await sumRange(prevY, prevM);
      if (prev > 0 && cur > prev * 1.5) {
        issues.push({
          type: "transport_mom_spike",
          severity: "warning",
          message: `今月の交通費合計が先月比で大幅増加しています（先月 ¥${Math.round(prev).toLocaleString("ja-JP")} → 今月 ¥${Math.round(cur).toLocaleString("ja-JP")}）（確認事項）。`,
        });
      }
    }
  }

  await appendExtendedCategoryRules(supabase, input, issues);
  await appendCompositeRules(supabase, input, issues);
  await appendSalesLinkedRules(supabase, input, issues);

  return issues;
}

export function scoreFromIssues(issues: ExpenseAuditIssue[]): number {
  let score = 100;
  for (const i of issues) {
    if (i.severity === "error") score -= 22;
    else if (i.severity === "warning") score -= 11;
    else score -= 4;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function verdictFromScore(
  score: number,
  issues: ExpenseAuditIssue[],
): "approve" | "review" | "reject" {
  const hasError = issues.some((i) => i.severity === "error");
  if (score < 50 || hasError) return "reject";
  if (score < 80) return "review";
  return "approve";
}
