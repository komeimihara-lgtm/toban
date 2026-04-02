import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { yearMonth } from "@/lib/incentive-rate-resolve";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const companyId = profile.company_id;
    const ym = yearMonth(year, month);
    const { data: rates, error } = await supabase
      .from("incentive_rates")
      .select("id, user_id, year_month, rate, formula_type")
      .eq("company_id", companyId)
      .eq("year_month", ym);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = [...new Set((rates ?? []).map((r) => (r as { user_id: string }).user_id))];
    const { data: names } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const nameById = new Map(
      (names ?? []).map((n) => [(n as { id: string }).id, (n as { full_name: string | null }).full_name]),
    );

    const result = (rates ?? []).map((r) => {
      const row = r as {
        id: string;
        user_id: string;
        year_month: string;
        rate: number;
        formula_type: string;
      };
      const [y, m] = row.year_month.split("-").map(Number);
      return {
        id: row.id,
        year: y,
        month: m,
        employee_id: row.user_id,
        employee_name: nameById.get(row.user_id) ?? null,
        rate: row.rate,
        formula_type: row.formula_type,
        created_by: null,
      };
    });

    return NextResponse.json({ rates: result });
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

    const body = (await req.json()) as {
      year?: number;
      month?: number;
      rates?: { employee_id: string; rate: number; formula_type?: string }[];
    };

    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }
    if (!Array.isArray(body.rates)) {
      return NextResponse.json({ error: "rates が必要です" }, { status: 400 });
    }

    const companyId = profile.company_id;
    const ym = yearMonth(year, month);
    const rows = body.rates.map((r) => ({
      company_id: companyId,
      user_id: r.employee_id,
      year_month: ym,
      rate: r.rate,
      formula_type: r.formula_type ?? "fixed_rate",
    }));

    const { error } = await supabase.from("incentive_rates").upsert(rows, {
      onConflict: "company_id,user_id,year_month",
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
