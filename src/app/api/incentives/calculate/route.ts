import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { resolveRateForEmployee, yearMonth } from "@/lib/incentive-rate-resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    const companyId = profile.company_id;

    const body = (await req.json()) as {
      year?: number;
      month?: number;
      department_id?: string;
    };
    const year = Number(body.year);
    const month = Number(body.month);
    const departmentId = String(body.department_id ?? "");
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12 || !departmentId) {
      return NextResponse.json({ error: "year, month, department_id が必要です" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: dept, error: de } = await admin
      .from("departments")
      .select("id, incentive_enabled, incentive_formula_type")
      .eq("id", departmentId)
      .eq("company_id", companyId)
      .single();
    if (de || !dept) {
      return NextResponse.json({ error: "部門が見つかりません" }, { status: 404 });
    }

    const d = dept as { incentive_enabled: boolean; incentive_formula_type: string };
    if (!d.incentive_enabled) {
      return NextResponse.json({ error: "この部門はインセンティブ対象外です" }, { status: 400 });
    }

    const { data: people, error: pe } = await admin
      .from("profiles")
      .select("id, full_name, is_sales_target, is_service_target, is_contract, department_id")
      .eq("company_id", companyId)
      .eq("department_id", departmentId)
      .eq("is_contract", false);

    if (pe) {
      return NextResponse.json({ error: pe.message }, { status: 500 });
    }

    const { data: existing } = await admin
      .from("incentive_configs")
      .select("employee_id, sales_amount")
      .eq("year", year)
      .eq("month", month)
      .eq("department_id", departmentId);

    const salesMap = new Map<string, number>();
    for (const row of existing ?? []) {
      const r = row as { employee_id: string; sales_amount: number };
      salesMap.set(r.employee_id, Number(r.sales_amount ?? 0));
    }

    const now = new Date().toISOString();
    const upserts: Record<string, unknown>[] = [];

    for (const p of people ?? []) {
      const row = p as {
        id: string;
        full_name: string | null;
        is_sales_target: boolean;
        is_service_target: boolean;
      };
      if (!row.is_sales_target && !row.is_service_target) continue;

      const { rate, formula_type } = await resolveRateForEmployee(
        admin,
        companyId,
        row.id,
        year,
        month,
      );
      const sales = salesMap.get(row.id) ?? 0;
      // rate はパーセント値（例: 3 → 売上の3%）
      const incentiveAmount = Math.floor((sales * rate) / 100);
      upserts.push({
        company_id: companyId,
        year,
        month,
        department_id: departmentId,
        employee_id: row.id,
        employee_name: row.full_name,
        sales_amount: sales,
        rate,
        incentive_amount: incentiveAmount,
        formula_type: formula_type ?? d.incentive_formula_type,
        status: "draft",
        updated_at: now,
      });
    }

    if (upserts.length === 0) {
      return NextResponse.json({ configs: [], message: "対象者がいません" });
    }

    const { error: upErr } = await admin.from("incentive_configs").upsert(upserts, {
      onConflict: "company_id,year,month,department_id,employee_id",
    });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const ym = yearMonth(year, month);
    const { data: refreshed } = await admin
      .from("incentive_configs")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .eq("department_id", departmentId)
      .order("employee_name");

    return NextResponse.json({ configs: refreshed ?? [], year_month: ym });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
