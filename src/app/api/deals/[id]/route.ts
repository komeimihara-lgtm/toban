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

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const { data: existing, error: exErr } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const e = existing as Record<string, unknown>;
    const body = (await req.json()) as Record<string, unknown>;

    const salon_name = body.salon_name != null ? String(body.salon_name).trim() : String(e.salon_name ?? "");
    const machine_type =
      body.machine_type != null ? String(body.machine_type).trim() : String(e.machine_type ?? "");
    const cost_price =
      body.cost_price != null ? Number(body.cost_price) : Number(e.cost_price ?? 0);
    const sale_price = body.sale_price != null ? Number(body.sale_price) : Number(e.sale_price ?? 0);
    const payment_method =
      body.payment_method != null ? String(body.payment_method).trim() : String(e.payment_method ?? "");
    const payment_date =
      body.payment_date !== undefined
        ? body.payment_date
          ? String(body.payment_date)
          : null
        : (e.payment_date as string | null);
    const appo_employee_id =
      body.appo_employee_id !== undefined ? (body.appo_employee_id as string | null) : (e.appo_employee_id as string | null);
    const closer_employee_id =
      body.closer_employee_id !== undefined
        ? (body.closer_employee_id as string | null)
        : (e.closer_employee_id as string | null);
    const hito_employee_id =
      body.hito_employee_id !== undefined
        ? (body.hito_employee_id as string | null)
        : (e.hito_employee_id as string | null);
    const hito_bottles =
      body.hito_bottles !== undefined
        ? (body.hito_bottles as number | null)
        : (e.hito_bottles as number | null);

    let payment_status =
      body.payment_status != null ? String(body.payment_status) : String(e.payment_status ?? "pending");
    if (!["pending", "partial", "paid"].includes(payment_status)) {
      return NextResponse.json({ error: "payment_status が不正です" }, { status: 400 });
    }

    const notes =
      body.notes !== undefined ? (body.notes ? String(body.notes) : null) : (e.notes as string | null);

    const year = body.year != null ? Number(body.year) : Number(e.year);
    const month = body.month != null ? Number(body.month) : Number(e.month);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year / month が不正です" }, { status: 400 });
    }

    if (!Number.isFinite(cost_price) || !Number.isFinite(sale_price)) {
      return NextResponse.json({ error: "cost_price / sale_price が不正です" }, { status: 400 });
    }

    if (!machine_type) {
      return NextResponse.json({ error: "machine_type が必要です" }, { status: 400 });
    }

    const machineRates = await loadRates(supabase, profile.company_id, machine_type);

    const computed = buildDealComputed(sale_price, cost_price, machineRates, {
      appoEmployeeId: appo_employee_id,
      closerEmployeeId: closer_employee_id,
      hitoEmployeeId: hito_employee_id,
      hitoBottles: hito_bottles,
    });

    const updateRow = {
      year,
      month,
      salon_name,
      machine_type,
      cost_price,
      sale_price,
      payment_method,
      payment_date,
      net_profit: computed.net_profit,
      appo_employee_id,
      closer_employee_id,
      hito_employee_id,
      hito_bottles,
      appo_incentive: computed.appo_incentive,
      closer_incentive: computed.closer_incentive,
      hito_incentive: computed.hito_incentive,
      payment_status,
      notes,
    };

    const { data: updated, error } = await supabase
      .from("deals")
      .update(updateRow)
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      deal: updated,
      incentive_finalized: payment_status === "paid",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const { error } = await supabase.from("deals").delete().eq("id", id).eq("company_id", profile.company_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
