"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { revalidatePath } from "next/cache";

type AdminCtx =
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: null; companyId: null; ok: false }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
      companyId: string;
      ok: true;
    };

async function requireAdmin(): Promise<AdminCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, companyId: null, ok: false };
  }
  const { data: me } = await supabase
    .from("employees")
    .select("role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const role = (me as { role?: string })?.role ?? "staff";
  const companyId = (me as { company_id?: string })?.company_id ?? null;
  if (!isAdminRole(role) || !companyId) {
    return { supabase, user: null, companyId: null, ok: false };
  }
  return { supabase, user: { id: user.id }, companyId, ok: true };
}

export async function upsertEmploymentContractAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requireAdmin();
  if (!ctx.ok) {
    return;
  }

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!employeeId) return;

  const employment_type = String(formData.get("employment_type") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();
  const trial_end_date =
    String(formData.get("trial_end_date") ?? "").trim() || null;
  const base_salary = parseOptionalNum(formData.get("base_salary"));
  const hourly_wage = parseOptionalNum(formData.get("hourly_wage"));
  const work_hours_per_day = parseOptionalNum(formData.get("work_hours_per_day"));
  const work_days_per_week = parseOptionalNum(formData.get("work_days_per_week"));
  const deemed_overtime_hours = parseOptionalNum(
    formData.get("deemed_overtime_hours"),
  );
  const deemed_overtime_amount = parseOptionalNum(
    formData.get("deemed_overtime_amount"),
  );
  const commute_allowance_monthly = parseOptionalNum(
    formData.get("commute_allowance_monthly"),
  );
  const commute_route = String(formData.get("commute_route") ?? "").trim() || null;
  const commute_distance_km = parseOptionalNum(
    formData.get("commute_distance_km"),
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const is_active = formData.getAll("is_active").includes("on");

  if (!start_date) return;

  const row = {
    employee_id: employeeId,
    company_id: ctx.companyId,
    employment_type:
      employment_type &&
      ["full_time", "part_time", "contract", "dispatch"].includes(employment_type)
        ? employment_type
        : null,
    start_date,
    hire_date: start_date,
    trial_end_date,
    base_salary,
    hourly_wage,
    work_hours_per_day,
    work_days_per_week,
    deemed_overtime_hours,
    deemed_overtime_amount,
    commute_allowance_monthly,
    commute_route,
    commute_distance_km,
    notes,
    is_active,
    updated_at: new Date().toISOString(),
  };

  const { error } = await ctx.supabase.from("employment_contracts").upsert(row, {
    onConflict: "employee_id",
  });
  if (error) {
    console.error("employment_contracts upsert:", error.message);
    return;
  }
  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my/contract");
}

function parseOptionalNum(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function upsertCommuteExpenseAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requireAdmin();
  if (!ctx.ok) {
    return;
  }

  const id = String(formData.get("id") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!employeeId) return;

  const route_name = String(formData.get("route_name") ?? "").trim() || null;
  const from_station = String(formData.get("from_station") ?? "").trim() || null;
  const to_station = String(formData.get("to_station") ?? "").trim() || null;
  const transportation = String(formData.get("transportation") ?? "train");
  const monthly_amount = Number(formData.get("monthly_amount") ?? 0) || 0;
  const ticket_type = String(formData.get("ticket_type") ?? "monthly");
  const valid_from = String(formData.get("valid_from") ?? "").trim() || null;
  const valid_to = String(formData.get("valid_to") ?? "").trim() || null;
  const is_active = formData.getAll("is_active").includes("on");

  const payload = {
    employee_id: employeeId,
    company_id: ctx.companyId,
    route_name,
    from_station,
    to_station,
    transportation:
      ["train", "bus", "car", "bicycle", "walk"].includes(transportation)
        ? transportation
        : "train",
    monthly_amount,
    ticket_type: ["monthly", "quarterly", "annual"].includes(ticket_type)
      ? ticket_type
      : "monthly",
    valid_from,
    valid_to,
    is_active,
  };

  if (id) {
    const { error } = await ctx.supabase
      .from("commute_expenses")
      .update(payload)
      .eq("id", id)
      .eq("company_id", ctx.companyId);
    if (error) {
      console.error("commute_expenses update:", error.message);
      return;
    }
  } else {
    const { error } = await ctx.supabase.from("commute_expenses").insert(payload);
    if (error) {
      console.error("commute_expenses insert:", error.message);
      return;
    }
  }

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
}
