import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const departmentId = url.searchParams.get("department_id") ?? undefined;

    let q = supabase.from("incentive_configs").select("*").order("employee_name");

    if (year) q = q.eq("year", Number(year));
    if (month) q = q.eq("month", Number(month));
    if (departmentId) q = q.eq("department_id", departmentId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!isOwnerOrApprover(profile.role)) {
      const filtered = (data ?? []).filter((r) => (r as { employee_id: string }).employee_id === user.id);
      return NextResponse.json({ configs: filtered });
    }

    return NextResponse.json({ configs: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    const body = (await req.json()) as { configs?: Record<string, unknown>[] };
    const configs = body.configs;
    if (!Array.isArray(configs) || configs.length === 0) {
      return NextResponse.json({ error: "configs が必要です" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rows = configs.map((c) => ({
      company_id: profile.company_id,
      year: Number(c.year),
      month: Number(c.month),
      department_id: String(c.department_id),
      employee_id: String(c.employee_id),
      employee_name: c.employee_name != null ? String(c.employee_name) : null,
      sales_amount: Number(c.sales_amount ?? 0),
      rate: Number(c.rate ?? 0),
      incentive_amount: Number(c.incentive_amount ?? 0),
      formula_type: String(c.formula_type ?? "fixed_rate"),
      status: String(c.status ?? "draft"),
      notes: c.notes != null ? String(c.notes) : null,
      updated_at: now,
    }));

    const { error } = await supabase.from("incentive_configs").upsert(rows, {
      onConflict: "company_id,year,month,department_id,employee_id",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
