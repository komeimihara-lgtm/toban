import type { AuthProfile } from "@/lib/api-auth";
import { claudeExpenseAuditNarrative } from "@/lib/expense-audit-claude";
import {
  runExpenseAuditRules,
  scoreFromIssues,
  verdictFromScore,
} from "@/lib/expense-audit-rules";
import type { ExpenseAuditInput, ExpenseAuditResult } from "@/types/expense-audit";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchIsSalesTarget(
  supabase: SupabaseClient,
  submitterId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_sales_target")
    .eq("id", submitterId)
    .maybeSingle();
  return Boolean((data as { is_sales_target?: boolean } | null)?.is_sales_target);
}

/**
 * 申請直後など: DB上の経費1件を読み、AI審査を実行して audit_* 列に保存する。
 */
export async function runPersistedExpenseAuditById(
  supabase: SupabaseClient,
  profile: AuthProfile,
  expenseId: string,
): Promise<{ ok: true; result: ExpenseAuditResult } | { ok: false; error: string }> {
  const { data: row, error } = await supabase
    .from("expenses")
    .select(
      "id, company_id, submitter_id, type, category, amount, paid_date, vendor, purpose, attendees, from_location, to_location, receipt_url, created_at, activity_report_id",
    )
    .eq("id", expenseId)
    .single();
  if (error || !row) {
    return { ok: false, error: "経費が見つかりません" };
  }
  const e = row as Record<string, unknown>;
  const isAdmin = profile.role === "owner" || profile.role === "approver";
  const isSubmitter = e.submitter_id === profile.id;
  if (!isSubmitter && !isAdmin) {
    return { ok: false, error: "権限がありません" };
  }
  if (String(e.company_id) !== profile.company_id) {
    return { ok: false, error: "会社が一致しません" };
  }

  const input: ExpenseAuditInput = {
    id: expenseId,
    submitter_id: String(e.submitter_id),
    company_id: String(e.company_id),
    type: String(e.type ?? ""),
    category: String(e.category ?? ""),
    amount: Number(e.amount),
    paid_date: String(e.paid_date ?? ""),
    vendor: String(e.vendor ?? ""),
    purpose: String(e.purpose ?? ""),
    attendees: e.attendees != null ? String(e.attendees) : null,
    from_location: e.from_location != null ? String(e.from_location) : null,
    to_location: e.to_location != null ? String(e.to_location) : null,
    receipt_url: e.receipt_url != null ? String(e.receipt_url) : null,
    created_at: e.created_at != null ? String(e.created_at) : null,
    activity_report_id: e.activity_report_id != null ? String(e.activity_report_id) : null,
    ride_hour_local: null,
  };

  const arId = input.activity_report_id;
  if (arId) {
    const { data: ar } = await supabase
      .from("activity_reports")
      .select("visit_count, meeting_count, area, client_names")
      .eq("id", arId)
      .maybeSingle();
    if (ar) {
      const arRow = ar as {
        visit_count?: number;
        meeting_count?: number;
        area?: string | null;
        client_names?: string | null;
      };
      input.activity_visit_count = Number(arRow.visit_count ?? 0) || 0;
      input.activity_meeting_count = Number(arRow.meeting_count ?? 0) || 0;
      input.activity_area = arRow.area ?? null;
      input.activity_client_names = arRow.client_names ?? null;
    }
  }

  input.is_sales_target = await fetchIsSalesTarget(
    supabase,
    String(e.submitter_id),
  );

  const issues = await runExpenseAuditRules(supabase, input);
  const score = scoreFromIssues(issues);
  const verdict = verdictFromScore(score, issues);

  const expenseSummary = JSON.stringify(
    {
      category: input.category,
      amount: input.amount,
      vendor: input.vendor,
      purpose: input.purpose.slice(0, 240),
      paid_date: input.paid_date,
      attendees: input.attendees,
      from: input.from_location,
      to: input.to_location,
      is_sales_target: input.is_sales_target,
      activity: {
        visit_count: input.activity_visit_count,
        meeting_count: input.activity_meeting_count,
        area: input.activity_area,
        clients: input.activity_client_names,
      },
    },
    null,
    0,
  );

  const { summary, suggestions } = await claudeExpenseAuditNarrative({
    expenseSummary,
    issues,
    score,
    verdict,
  });

  const result: ExpenseAuditResult = {
    verdict,
    score,
    issues,
    summary,
    suggestions,
  };

  const { error: upErr } = await supabase
    .from("expenses")
    .update({
      audit_result: result as unknown as Record<string, unknown>,
      audit_score: score,
      audit_at: new Date().toISOString(),
    })
    .eq("id", expenseId)
    .eq("company_id", profile.company_id);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, result };
}
