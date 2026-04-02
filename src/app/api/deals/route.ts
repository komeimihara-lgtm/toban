import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { buildDealComputed, ratesFromDbRows } from "@/lib/deals-compute";
import type { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function loadRates(supabase: SupabaseServer, companyId: string, machineType: string) {
  const { data: rateRows } = await supabase
    .from("deal_incentive_rates")
    .select("role, rate")
    .eq("company_id", companyId)
    .eq("machine_type", machineType);
  return ratesFromDbRows((rateRows as { role: string; rate: number }[] | null) ?? null);
}

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
    const employeeId = url.searchParams.get("employee_id");

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    let q = supabase
      .from("deals")
      .select(
        "id, company_id, year, month, salon_name, machine_type, cost_price, sale_price, payment_method, payment_date, net_profit, appo_employee_id, closer_employee_id, hito_employee_id, hito_bottles, appo_incentive, closer_incentive, hito_incentive, payment_status, notes, created_at, updated_at",
      )
      .eq("company_id", profile.company_id)
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: false });

    if (employeeId) {
      q = q.or(
        `appo_employee_id.eq.${employeeId},closer_employee_id.eq.${employeeId},hito_employee_id.eq.${employeeId}`,
      );
    }

    const { data: deals, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const empIds = new Set<string>();
    for (const d of deals ?? []) {
      const row = d as Record<string, string | null>;
      if (row.appo_employee_id) empIds.add(row.appo_employee_id);
      if (row.closer_employee_id) empIds.add(row.closer_employee_id);
      if (row.hito_employee_id) empIds.add(row.hito_employee_id);
    }

    const { data: names } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", empIds.size ? [...empIds] : ["00000000-0000-0000-0000-000000000000"]);

    const nameById = new Map(
      (names ?? []).map((n) => [(n as { id: string }).id, (n as { full_name: string | null }).full_name]),
    );

    const result = (deals ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...r,
        appo_employee_name: nameById.get(String(r.appo_employee_id ?? "")) ?? null,
        closer_employee_name: nameById.get(String(r.closer_employee_id ?? "")) ?? null,
        hito_employee_name: nameById.get(String(r.hito_employee_id ?? "")) ?? null,
      };
    });

    return NextResponse.json({ deals: result });
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
      salon_name?: string;
      machine_type?: string;
      cost_price?: number;
      sale_price?: number;
      payment_method?: string;
      payment_date?: string | null;
      appo_employee_id?: string | null;
      closer_employee_id?: string | null;
      hito_employee_id?: string | null;
      hito_bottles?: number | null;
      payment_status?: string;
      notes?: string | null;
    };

    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const machineType = String(body.machine_type ?? "").trim();
    if (!machineType) {
      return NextResponse.json({ error: "machine_type が必要です" }, { status: 400 });
    }

    const cost_price = Number(body.cost_price ?? 0);
    const sale_price = Number(body.sale_price ?? 0);
    if (!Number.isFinite(cost_price) || !Number.isFinite(sale_price)) {
      return NextResponse.json({ error: "cost_price / sale_price が不正です" }, { status: 400 });
    }

    const machineRates = await loadRates(supabase, profile.company_id, machineType);

    const computed = buildDealComputed(sale_price, cost_price, machineRates, {
      appoEmployeeId: body.appo_employee_id ?? null,
      closerEmployeeId: body.closer_employee_id ?? null,
      hitoEmployeeId: body.hito_employee_id ?? null,
      hitoBottles: body.hito_bottles ?? null,
    });

    const payment_status = (body.payment_status ?? "pending") as string;
    if (!["pending", "partial", "paid"].includes(payment_status)) {
      return NextResponse.json({ error: "payment_status が不正です" }, { status: 400 });
    }

    const insertRow = {
      company_id: profile.company_id,
      year,
      month,
      salon_name: String(body.salon_name ?? "").trim(),
      machine_type: machineType,
      cost_price,
      sale_price,
      payment_method: String(body.payment_method ?? "").trim(),
      payment_date: body.payment_date || null,
      net_profit: computed.net_profit,
      appo_employee_id: body.appo_employee_id || null,
      closer_employee_id: body.closer_employee_id || null,
      hito_employee_id: body.hito_employee_id || null,
      hito_bottles: body.hito_bottles ?? null,
      appo_incentive: computed.appo_incentive,
      closer_incentive: computed.closer_incentive,
      hito_incentive: computed.hito_incentive,
      payment_status,
      notes: body.notes?.trim() ? body.notes : null,
      created_by: user.id,
    };

    const { data: created, error } = await supabase
      .from("deals")
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deal: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
