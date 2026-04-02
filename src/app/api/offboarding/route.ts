import {
  getProfile,
  getSessionUser,
  isOwnerOrApprover,
} from "@/lib/api-auth";
import { OFFBOARDING_TASK_SEEDS } from "@/lib/onboarding-task-seeds";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const url = new URL(req.url);
  const forRecord = url.searchParams.get("employee_record_id");

  if (forRecord && isOwnerOrApprover(profile.role)) {
    const { data: emp } = await supabase
      .from("employees")
      .select(
        "id, user_id, company_id, resignation_date, last_working_date, offboarding_status, scheduled_auth_deactivation_date",
      )
      .eq("id", forRecord)
      .maybeSingle();
    const e = emp as { company_id?: string } | null;
    if (!e || e.company_id !== profile.company_id) {
      return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
    }
    const { data: tasks, error: te } = await supabase
      .from("offboarding_tasks")
      .select("*")
      .eq("employee_record_id", forRecord)
      .order("created_at", { ascending: true });
    if (te) {
      return NextResponse.json({ error: te.message }, { status: 500 });
    }
    return NextResponse.json({
      employee: emp,
      tasks: tasks ?? [],
    });
  }

  const { data: emp } = await supabase
    .from("employees")
    .select(
      "id, user_id, resignation_date, last_working_date, offboarding_status, scheduled_auth_deactivation_date, company_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!emp) {
    return NextResponse.json({ employee: null, tasks: [] });
  }

  const eid = (emp as { id: string }).id;
  const { data: tasks, error: te } = await supabase
    .from("offboarding_tasks")
    .select("*")
    .eq("employee_record_id", eid)
    .order("created_at", { ascending: true });

  if (te) {
    return NextResponse.json({ error: te.message }, { status: 500 });
  }

  let paidLeaveDays: number | null = null;
  let monthlyContractTotal: number | null = null;
  const { data: bal } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining")
    .eq("user_id", user.id)
    .maybeSingle();
  if (bal) {
    paidLeaveDays = Number((bal as { days_remaining: number }).days_remaining);
  }
  const { data: c } = await supabase
    .from("employment_contracts")
    .select("base_salary")
    .eq("employee_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (c) {
    const cr = c as { base_salary: number | null };
    monthlyContractTotal = Number(cr.base_salary ?? 0);
  }

  return NextResponse.json({
    employee: emp,
    tasks: tasks ?? [],
    paid_leave_days_remaining: paidLeaveDays,
    monthly_contract_hint: monthlyContractTotal,
  });
}

export async function POST(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  if (!isOwnerOrApprover(profile.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as {
    employee_id?: string;
    resignation_date?: string;
    last_working_date?: string;
  };

  const employeeRecordId = String(body.employee_id ?? "").trim();
  const resignationDate = String(body.resignation_date ?? "").trim();
  const lastWorkingDate = String(body.last_working_date ?? "").trim();

  if (!employeeRecordId || !resignationDate || !lastWorkingDate) {
    return NextResponse.json(
      { error: "employee_id, resignation_date, last_working_date が必要です" },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "サーバー設定エラー" }, { status: 503 });
  }

  const { data: emp, error: fe } = await admin
    .from("employees")
    .select("id, company_id, user_id")
    .eq("id", employeeRecordId)
    .single();

  if (fe || !emp) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }

  const er = emp as { id: string; company_id: string; user_id: string };
  if (er.company_id !== profile.company_id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { count } = await admin
    .from("offboarding_tasks")
    .select("*", { count: "exact", head: true })
    .eq("employee_record_id", er.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "既に退社タスクが作成されています" },
      { status: 400 },
    );
  }

  const { error: upE } = await admin
    .from("employees")
    .update({
      resignation_date: resignationDate,
      last_working_date: lastWorkingDate,
      offboarding_status: "offboarding",
    })
    .eq("id", er.id);

  if (upE) {
    return NextResponse.json({ error: upE.message }, { status: 500 });
  }

  const rows = OFFBOARDING_TASK_SEEDS.map((s) => ({
    company_id: er.company_id,
    employee_record_id: er.id,
    task_type: s.task_type,
    title: s.title,
    description: s.description,
    status: "pending",
  }));

  const { error: insE } = await admin.from("offboarding_tasks").insert(rows);
  if (insE) {
    return NextResponse.json({ error: insE.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
