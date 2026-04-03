import { getProfile, getSessionUser } from "@/lib/api-auth";
import { resolveIsSalesTarget } from "@/lib/employee-sales-target";
import { tryAutoApproveExpense } from "@/lib/expense-auto-approve";
import { runPersistedExpenseAuditById } from "@/lib/expense-audit-run";
import { isActiveExpenseCategoryLabel } from "@/lib/expense-category-validate";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeCompanySettings,
  usesLineChannel,
} from "@/lib/company-settings";
import { enqueueNotification } from "@/lib/notification-queue";
import type { ExpenseType } from "@/types/index";
import { NextResponse } from "next/server";

export const maxDuration = 120;

function lastDay(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const submitterId = url.searchParams.get("submitter_id") ?? undefined;
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");

    let q = supabase.from("expenses").select("*").order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);
    if (submitterId) q = q.eq("submitter_id", submitterId);
    if (year && month) {
      const y = Number(year);
      const mo = Number(month);
      if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const end = lastDay(y, mo);
        q = q
          .gte("paid_date", `${y}-${pad(mo)}-01`)
          .lte("paid_date", `${y}-${pad(mo)}-${String(end).padStart(2, "0")}`);
      }
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ expenses: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function isExpenseType(x: string): x is ExpenseType {
  return (
    x === "expense" ||
    x === "travel" ||
    x === "advance" ||
    x === "advance_settle"
  );
}

function isTravelishCategory(category: string) {
  return (
    category === "交通費" ||
    category.includes("交通") ||
    category.includes("出張") ||
    category.includes("宿泊")
  );
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const type = String(body.type ?? "expense");
    if (!isExpenseType(type)) {
      return NextResponse.json({ error: "無効な申請種別です" }, { status: 400 });
    }

    const category = String(body.category ?? "");
    const amount = Number(body.amount);
    const purpose = String(body.purpose ?? "").trim();
    const paidDate = String(body.paid_date ?? "").trim();
    const submit = Boolean(body.submit);

    if (!purpose) {
      return NextResponse.json({ error: "用途・目的は必須です" }, { status: 400 });
    }
    if (!paidDate) {
      return NextResponse.json({ error: "支払日は必須です" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "金額は正の数で入力してください" }, { status: 400 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    const okCat = await isActiveExpenseCategoryLabel(
      supabase,
      profile.company_id,
      category,
    );
    if (!okCat) {
      return NextResponse.json({ error: "カテゴリが不正です（会社マスタを確認）" }, { status: 400 });
    }

    const vendor = String(body.vendor ?? "").trim();
    if (!vendor) {
      return NextResponse.json({ error: "支払先（vendor）は必須です" }, { status: 400 });
    }
    const attendees = body.attendees != null ? String(body.attendees) : null;
    const fromLocation = body.from_location != null ? String(body.from_location) : null;
    const toLocation = body.to_location != null ? String(body.to_location) : null;
    const receiptUrl = body.receipt_url != null ? String(body.receipt_url) : null;

    const status = submit ? "step1_pending" : "draft";

    let activityReportId: string | null = null;
    const isSales = await resolveIsSalesTarget(
      supabase,
      user.id,
      profile.is_sales_target,
    );
    if (isSales && isTravelishCategory(category)) {
      const visitRaw = body.activity_visit_count;
      const meetRaw = body.activity_meeting_count;
      const visitN =
        visitRaw != null && visitRaw !== ""
          ? Math.max(0, Math.floor(Number(visitRaw)))
          : null;
      const meetN =
        meetRaw != null && meetRaw !== ""
          ? Math.max(0, Math.floor(Number(meetRaw)))
          : null;
      const area =
        body.activity_area != null ? String(body.activity_area).trim() : "";
      const clients =
        body.activity_client_names != null
          ? String(body.activity_client_names).trim()
          : "";
      const hasActivity =
        (visitN != null && visitN > 0) ||
        (meetN != null && meetN > 0) ||
        area.length > 0 ||
        clients.length > 0;
      if (hasActivity) {
        const { data: ar, error: arErr } = await supabase
          .from("activity_reports")
          .insert({
            company_id: profile.company_id,
            employee_id: user.id,
            report_date: paidDate,
            visit_count: visitN ?? 0,
            meeting_count: meetN ?? 0,
            area: area || null,
            client_names: clients || null,
          })
          .select("id")
          .single();
        if (!arErr && ar) {
          activityReportId = (ar as { id: string }).id;
        }
      }
    }

    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert({
        company_id: profile.company_id,
        type,
        status,
        submitter_id: user.id,
        submitter_name: profile.full_name,
        department_id: profile.department_id,
        category,
        amount,
        paid_date: paidDate,
        vendor,
        purpose,
        attendees,
        from_location: fromLocation,
        to_location: toLocation,
        receipt_url: receiptUrl,
        activity_report_id: activityReportId,
        receipt_ocr_data:
          body.receipt_ocr_data && typeof body.receipt_ocr_data === "object"
            ? (body.receipt_ocr_data as Record<string, unknown>)
            : null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const newId = (inserted as { id: string }).id;
    let autoApproved = false;
    let responseStatus: string = status;

    const rideRaw = body.ride_hour_local;
    const rideHourLocal =
      rideRaw != null && rideRaw !== "" && Number.isFinite(Number(rideRaw))
        ? Math.max(0, Math.min(23, Math.floor(Number(rideRaw))))
        : null;

    if (submit) {
      try {
        const auditRes = await runPersistedExpenseAuditById(
          supabase,
          profile,
          newId,
          rideHourLocal != null ? { ride_hour_local: rideHourLocal } : undefined,
        );
        if (!auditRes.ok) {
          console.error("[expenses POST] audit:", auditRes.error);
        } else {
          try {
            const admin = createAdminClient();
            const { approved } = await tryAutoApproveExpense(admin, newId);
            autoApproved = approved;
            if (approved) {
              responseStatus = "approved";
            }
          } catch (e) {
            console.warn("[expenses POST] auto-approve:", e);
          }
        }
      } catch (e) {
        console.error("[expenses POST] audit/auto chain:", e);
      }

      if (!autoApproved) {
        try {
          const admin = createAdminClient();
          const { data: co } = await admin
            .from("companies")
            .select("settings")
            .eq("id", profile.company_id)
            .maybeSingle();
          const settings = normalizeCompanySettings(
            (co as { settings?: unknown } | null)?.settings,
          );
          const { data: approvers } = await admin
            .from("profiles")
            .select("line_user_id, full_name")
            .eq("role", "approver")
            .eq("company_id", profile.company_id);
          const msg = `経費申請の第1承認待ち: ${profile.full_name ?? "申請者"} / ¥${amount.toLocaleString("ja-JP")}`;
          for (const row of approvers ?? []) {
            const ln = (row as { line_user_id: string | null }).line_user_id;
            if (usesLineChannel(settings) && ln) {
              await enqueueNotification({
                company_id: profile.company_id,
                type: "expense_step1_request",
                recipient_line_id: ln,
                message: msg,
              });
            }
          }
        } catch {
          /* 通知失敗は申請自体は成功 */
        }
      }
    }

    return NextResponse.json(
      { id: newId, status: responseStatus, autoApproved },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
