import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
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

    const { data, error } = await supabase
      .from("deal_month_submissions")
      .select("id, submitted_at, submitted_by, summary")
      .eq("company_id", profile.company_id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submission: data ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function aggregateDeals(deals: Record<string, unknown>[]) {
  const byStaff: Record<
    string,
    { name: string | null; appo: number; closer: number; total: number }
  > = {};

  const add = (empId: string | null, name: string | null, field: "appo" | "closer", amount: number) => {
    if (!empId) return;
    if (!byStaff[empId]) {
      byStaff[empId] = { name, appo: 0, closer: 0, total: 0 };
    }
    byStaff[empId][field] += amount;
    byStaff[empId].total += amount;
    if (name) byStaff[empId].name = name;
  };

  let grandAppo = 0;
  let grandCloser = 0;

  for (const d of deals) {
    const appo = Number(d.appo_incentive ?? 0);
    const closer = Number(d.closer_incentive ?? 0);
    grandAppo += appo;
    grandCloser += closer;

    add(
      (d.appo_employee_id as string) ?? null,
      (d.appo_employee_name as string) ?? null,
      "appo",
      appo,
    );
    add(
      (d.closer_employee_id as string) ?? null,
      (d.closer_employee_name as string) ?? null,
      "closer",
      closer,
    );
  }

  const staffList = Object.entries(byStaff).map(([employee_id, v]) => ({
    employee_id,
    employee_name: v.name,
    appo: v.appo,
    closer: v.closer,
    total: v.total,
  }));

  return {
    staff: staffList,
    totals: {
      appo: grandAppo,
      closer: grandCloser,
      grand: grandAppo + grandCloser,
    },
    deal_count: deals.length,
  };
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

    const body = (await req.json()) as { year?: number; month?: number };
    const year = Number(body.year);
    const month = Number(body.month);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const { data: deals, error: dErr } = await supabase
      .from("deals")
      .select("id, appo_employee_id, closer_employee_id, appo_incentive, closer_incentive")
      .eq("company_id", profile.company_id)
      .eq("year", year)
      .eq("month", month);

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    const list = (deals ?? []) as Record<string, unknown>[];
    const empIds = new Set<string>();
    for (const d of list) {
      if (d.appo_employee_id) empIds.add(String(d.appo_employee_id));
      if (d.closer_employee_id) empIds.add(String(d.closer_employee_id));
    }

    const { data: names } = await supabase
      .from("employees")
      .select("auth_user_id, name")
      .in("auth_user_id", empIds.size ? [...empIds] : ["00000000-0000-0000-0000-000000000000"]);

    const nameById = new Map(
      (names ?? []).map((n) => [(n as { auth_user_id: string }).auth_user_id, (n as { name: string | null }).name]),
    );

    const enriched = list.map((d) => ({
      ...d,
      appo_employee_name: d.appo_employee_id ? nameById.get(String(d.appo_employee_id)) ?? null : null,
      closer_employee_name: d.closer_employee_id
        ? nameById.get(String(d.closer_employee_id)) ?? null
        : null,
    }));

    const summary = aggregateDeals(enriched);

    const row = {
      company_id: profile.company_id,
      year,
      month,
      submitted_by: user.id,
      summary: summary as unknown as Record<string, unknown>,
    };

    const { data: saved, error } = await supabase
      .from("deal_month_submissions")
      .upsert(row, { onConflict: "company_id,year,month" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, submission: saved, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
