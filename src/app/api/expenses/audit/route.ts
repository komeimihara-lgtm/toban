/**
 * POST JSON: { expense_id?: string, expense_data?: Partial<ExpenseAuditInput>, persist?: boolean }
 * - expense_id: DB の行を読み取り審査（persist 既定 true で audit_* 列を更新）
 * - expense_data: 下書きプレビュー用（category, amount, paid_date 必須。persist は無視）
 * レスポンス: { verdict, score, issues, summary, suggestions }
 */
import { getProfile, getSessionUser } from "@/lib/api-auth";
import { claudeExpenseAuditNarrative } from "@/lib/expense-audit-claude";
import { enrichInputFromLinkedActivityReports } from "@/lib/expense-audit-sales-enrich";
import {
  runExpenseAuditRules,
  scoreFromIssues,
  verdictFromScore,
} from "@/lib/expense-audit-rules";
import { getProfileSalesTargetFlag, resolveIsSalesTarget } from "@/lib/employee-sales-target";
import type { ExpenseAuditInput, ExpenseAuditResult } from "@/types/expense-audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 120;

function numFromUnknown(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mergeExpenseDataOverrides(
  input: ExpenseAuditInput,
  ext: Partial<ExpenseAuditInput> | undefined,
): void {
  if (!ext) return;
  const v = numFromUnknown(ext.activity_visit_count);
  if (v != null) input.activity_visit_count = Math.max(0, Math.floor(v));
  const m = numFromUnknown(ext.activity_meeting_count);
  if (m != null) input.activity_meeting_count = Math.max(0, Math.floor(m));
  if (ext.activity_area !== undefined) {
    input.activity_area = ext.activity_area?.trim() ? String(ext.activity_area) : null;
  }
  if (ext.activity_client_names !== undefined) {
    input.activity_client_names = ext.activity_client_names?.trim()
      ? String(ext.activity_client_names)
      : null;
  }
  if (ext.ride_hour_local !== undefined) input.ride_hour_local = ext.ride_hour_local;
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = (await req.json()) as {
      expense_id?: string;
      expense_data?: Partial<ExpenseAuditInput>;
      persist?: boolean;
    };

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    let input: ExpenseAuditInput;
    const expenseId = body.expense_id?.trim() || null;

    if (expenseId) {
      const { data: row, error } = await supabase
        .from("expenses")
        .select(
          "id, company_id, submitter_id, type, category, amount, paid_date, vendor, purpose, attendees, from_location, to_location, receipt_url, created_at, activity_report_id",
        )
        .eq("id", expenseId)
        .single();
      if (error || !row) {
        return NextResponse.json({ error: "経費が見つかりません" }, { status: 404 });
      }
      const e = row as Record<string, unknown>;
      const isAdmin = profile.role === "owner" || profile.role === "approver";
      const isSubmitter = e.submitter_id === user.id;
      if (!isSubmitter && !isAdmin) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }

      input = {
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
        activity_report_id:
          e.activity_report_id != null ? String(e.activity_report_id) : null,
        ride_hour_local: body.expense_data?.ride_hour_local ?? null,
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

      mergeExpenseDataOverrides(input, body.expense_data);
      const submitterId = String(e.submitter_id);
      input.is_sales_target = await resolveIsSalesTarget(
        supabase,
        submitterId,
        await getProfileSalesTargetFlag(supabase, submitterId),
      );
      await enrichInputFromLinkedActivityReports(supabase, input);
    } else if (body.expense_data) {
      const d = body.expense_data;
      input = {
        submitter_id: user.id,
        company_id: profile.company_id,
        type: d.type != null ? String(d.type) : "expense",
        category: String(d.category ?? ""),
        amount: Number(d.amount),
        paid_date: String(d.paid_date ?? ""),
        vendor: String(d.vendor ?? ""),
        purpose: String(d.purpose ?? ""),
        attendees: d.attendees != null ? String(d.attendees) : null,
        from_location: d.from_location != null ? String(d.from_location) : null,
        to_location: d.to_location != null ? String(d.to_location) : null,
        receipt_url: d.receipt_url != null ? String(d.receipt_url) : null,
        ride_hour_local: d.ride_hour_local ?? null,
        created_at: d.created_at != null ? String(d.created_at) : null,
      };
      mergeExpenseDataOverrides(input, d);
      input.is_sales_target = await resolveIsSalesTarget(
        supabase,
        user.id,
        Boolean(profile.is_sales_target),
      );
      await enrichInputFromLinkedActivityReports(supabase, input);
      if (
        !input.category ||
        !Number.isFinite(input.amount) ||
        input.amount <= 0 ||
        !input.paid_date
      ) {
        return NextResponse.json(
          { error: "category, amount, paid_date は必須です" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "expense_id または expense_data が必要です" },
        { status: 400 },
      );
    }

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
        needs_ai_parse: issues.some((i) => Boolean(i.needs_ai_parse)),
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

    const shouldPersist =
      Boolean(expenseId) && body.persist !== false && input.company_id === profile.company_id;
    if (shouldPersist && expenseId) {
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
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[expenses/audit]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
