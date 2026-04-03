import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import {
  buildDealComputed,
  normalizeDealServices,
  ratesFromDbRows,
  sumDealServiceCosts,
} from "@/lib/deals-compute";
import type { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const DEAL_SELECT =
  "id, company_id, year, month, salon_name, machine_type, cost_price, sale_price, payment_method, payment_date, net_profit, deal_services, appo_employee_id, closer_employee_id, appo_incentive, closer_incentive, payment_status, submit_status, submitted_by, approved_by, reject_reason, notes, created_at, updated_at";

async function loadRates(supabase: SupabaseServer, companyId: string, machineType: string) {
  const { data: rateRows } = await supabase
    .from("deal_incentive_rates")
    .select("role, rate")
    .eq("company_id", companyId)
    .eq("machine_type", machineType);
  return ratesFromDbRows((rateRows as { role: string; rate: number }[] | null) ?? null);
}

function attachNames(
  deals: Record<string, unknown>[],
  nameById: Map<string, string | null | undefined>,
) {
  return deals.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...r,
      appo_employee_name: nameById.get(String(r.appo_employee_id ?? "")) ?? null,
      closer_employee_name: nameById.get(String(r.closer_employee_id ?? "")) ?? null,
      submitted_by_name: r.submitted_by ? nameById.get(String(r.submitted_by)) ?? null : null,
      approved_by_name: r.approved_by ? nameById.get(String(r.approved_by)) ?? null : null,
    };
  });
}

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const employeeId = url.searchParams.get("employee_id");
    const submitStatus = url.searchParams.get("submit_status");
    const pendingOnly = url.searchParams.get("pending_only") === "1";

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    let q = supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("company_id", profile.company_id)
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: false });

    if (!isOwnerOrApprover(profile.role)) {
      q = q.or(`appo_employee_id.eq.${user.id},closer_employee_id.eq.${user.id}`);
    } else {
      if (employeeId) {
        q = q.or(
          `appo_employee_id.eq.${employeeId},closer_employee_id.eq.${employeeId}`,
        );
      }
      if (pendingOnly) {
        q = q.eq("submit_status", "submitted");
      } else if (submitStatus && ["draft", "submitted", "approved", "rejected"].includes(submitStatus)) {
        q = q.eq("submit_status", submitStatus);
      }
    }

    const { data: deals, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const empIds = new Set<string>();
    for (const d of deals ?? []) {
      const row = d as Record<string, string | null | undefined>;
      if (row.appo_employee_id) empIds.add(String(row.appo_employee_id));
      if (row.closer_employee_id) empIds.add(String(row.closer_employee_id));
      if (row.submitted_by) empIds.add(String(row.submitted_by));
      if (row.approved_by) empIds.add(String(row.approved_by));
    }

    const { data: names } = await supabase
      .from("employees")
      .select("auth_user_id, name")
      .in("auth_user_id", empIds.size ? [...empIds] : ["00000000-0000-0000-0000-000000000000"]);

    const nameById = new Map(
      (names ?? []).map((n) => [(n as { auth_user_id: string }).auth_user_id, (n as { name: string | null }).name]),
    );

    return NextResponse.json({ deals: attachNames((deals ?? []) as Record<string, unknown>[], nameById) });
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
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
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
      is_appo?: boolean;
      is_closer?: boolean;
      payment_status?: string;
      submit_status?: string;
      notes?: string | null;
      deal_services?: unknown;
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

    let appo_employee_id = body.appo_employee_id ?? null;
    let closer_employee_id = body.closer_employee_id ?? null;

    // is_appo / is_closer フラグから employee_id を解決（全ロール共通）
    if (body.is_appo === true) appo_employee_id = appo_employee_id ?? user.id;
    if (body.is_closer === true) closer_employee_id = closer_employee_id ?? user.id;
    if (body.is_appo === false) appo_employee_id = null;
    if (body.is_closer === false) closer_employee_id = null;

    if (!isOwnerOrApprover(profile.role)) {
      if (!appo_employee_id && !closer_employee_id) {
        return NextResponse.json(
          { error: "アポまたはクローザーのいずれかに自分を割り当ててください" },
          { status: 400 },
        );
      }
      if (appo_employee_id && appo_employee_id !== user.id) {
        return NextResponse.json({ error: "アポ担当は自分のみ登録できます" }, { status: 403 });
      }
      if (closer_employee_id && closer_employee_id !== user.id) {
        return NextResponse.json({ error: "クローザー担当は自分のみ登録できます" }, { status: 403 });
      }
    }

    const cost_price = Number(body.cost_price ?? 0);
    const sale_price = Number(body.sale_price ?? 0);
    if (!Number.isFinite(cost_price) || !Number.isFinite(sale_price)) {
      return NextResponse.json({ error: "cost_price / sale_price が不正です" }, { status: 400 });
    }

    const machineRates = await loadRates(supabase, profile.company_id, machineType);

    const deal_services = normalizeDealServices(body.deal_services);
    const serviceTotal = sumDealServiceCosts(deal_services);

    const computed = buildDealComputed(
      sale_price,
      cost_price,
      machineRates,
      {
        appoEmployeeId: appo_employee_id,
        closerEmployeeId: closer_employee_id,
      },
      serviceTotal,
    );

    const payment_status = (body.payment_status ?? "pending") as string;
    if (!["pending", "partial", "paid"].includes(payment_status)) {
      return NextResponse.json({ error: "payment_status が不正です" }, { status: 400 });
    }

    let submit_status = (body.submit_status ?? "draft") as string;
    if (!isOwnerOrApprover(profile.role)) {
      submit_status = "draft";
    } else if (!["draft", "submitted", "approved", "rejected"].includes(submit_status)) {
      return NextResponse.json({ error: "submit_status が不正です" }, { status: 400 });
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
      deal_services,
      appo_employee_id,
      closer_employee_id,
      appo_incentive: computed.appo_incentive,
      closer_incentive: computed.closer_incentive,
      payment_status,
      submit_status,
      notes: body.notes?.trim() ? body.notes : null,
      submitted_by: null as string | null,
      approved_by: null as string | null,
      reject_reason: null as string | null,
    };

    if (!appo_employee_id && !closer_employee_id) {
      return NextResponse.json({ error: "アポまたはクローザー担当を指定してください" }, { status: 400 });
    }

    const { data: created, error } = await supabase.from("deals").insert(insertRow).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deal: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
