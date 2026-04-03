import { createClient } from "@/lib/supabase/server";
import { nextMilestoneGrantDelta, ymdJst } from "@/lib/paid-leave";
import { redirect } from "next/navigation";
import { ProfilePageTabs } from "./profile-page-tabs";

export const dynamic = "force-dynamic";

function formatDateJa(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function yen(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // --- プロフィール ---
  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const p = emp as {
    id?: string;
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
    emergency_contact?: string | null;
    emergency_name?: string | null;
    emergency_relation?: string | null;
    birth_date?: string | null;
    line_user_id?: string | null;
    department?: string | null;
    job_title?: string | null;
    department_id?: string | null;
  } | null;

  let departmentLabel = "—";
  const depId = p?.department_id;
  if (depId) {
    const { data: depRow } = await supabase
      .from("departments")
      .select("name")
      .eq("id", depId)
      .maybeSingle();
    const masterName = (depRow as { name?: string | null } | null)?.name?.trim();
    departmentLabel = masterName || p?.department?.trim() || "—";
  } else if (p?.department?.trim()) {
    departmentLabel = p.department.trim();
  }

  const employeePk = p?.id ?? null;

  let hireDateLabel = "—";
  if (employeePk) {
    const { data: contract } = await supabase
      .from("employment_contracts")
      .select("hire_date, start_date")
      .eq("employee_id", employeePk)
      .maybeSingle();
    const c = contract as { hire_date?: string | null; start_date?: string | null } | null;
    hireDateLabel = formatDateJa(c?.hire_date ?? c?.start_date ?? null);
  }

  const bdRaw = p?.birth_date;
  const bd = typeof bdRaw === "string" ? bdRaw.trim() : null;

  const profileProps = {
    full_name: p?.full_name?.trim() ?? "",
    phone: p?.phone?.trim() ?? "",
    address: p?.address?.trim() ?? "",
    birth_date: bd && bd.length >= 10 ? bd.slice(0, 10) : bd ?? "",
    emergency_name: p?.emergency_name?.trim() ?? "",
    emergency_relation: p?.emergency_relation?.trim() ?? "",
    emergency_contact: p?.emergency_contact?.trim() ?? "",
    line_user_id: p?.line_user_id?.trim() ?? "",
  };

  // --- 雇用契約 ---
  const { data: contractRow } = employeePk
    ? await supabase
        .from("employment_contracts")
        .select("*")
        .eq("employee_id", employeePk)
        .maybeSingle()
    : { data: null };

  const { data: commutes } = employeePk
    ? await supabase
        .from("commute_expenses")
        .select(
          "route_name, from_station, to_station, transportation, monthly_amount, ticket_type, is_active",
        )
        .eq("employee_id", employeePk)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: plb } = await supabase
    .from("paid_leave_balances")
    .select("days_remaining, next_accrual_date, next_accrual_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = (contractRow ?? {}) as Record<string, unknown>;
  const startYmd = String(row.start_date ?? row.hire_date ?? "");
  let nextGrantYmd: string | null = null;
  let nextGrantDelta: number | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
    const hire = new Date(`${startYmd}T12:00:00+09:00`);
    const milestone = nextMilestoneGrantDelta(hire);
    if (milestone) {
      nextGrantYmd = ymdJst(milestone.date);
      nextGrantDelta = milestone.delta;
    }
  }

  const cacheNext =
    row.next_paid_leave_date != null ? String(row.next_paid_leave_date) : null;
  const cacheDays =
    row.next_paid_leave_days != null ? Number(row.next_paid_leave_days) : null;

  const plbTyped = plb as {
    days_remaining?: number;
    next_accrual_date?: string;
    next_accrual_days?: number;
  } | null;

  const contractData = {
    noContract: !contractRow,
    baseSalary: yen(row.base_salary as number),
    deemedOvertimeHours: row.deemed_overtime_hours != null ? `${row.deemed_overtime_hours} 時間` : "—",
    deemedOvertimeAmount: yen(row.deemed_overtime_amount as number),
    startDate: String(row.start_date ?? row.hire_date ?? "—"),
    trialEndDate: String(row.trial_end_date ?? "—"),
    commutes: (commutes ?? []).map((raw) => {
      const m = raw as {
        route_name: string | null;
        from_station: string | null;
        to_station: string | null;
        transportation: string;
        monthly_amount: number;
        ticket_type: string;
      };
      return {
        routeName:
          m.route_name?.trim() ||
          [m.from_station, m.to_station].filter(Boolean).join(" → ") ||
          "経路",
        transportation: m.transportation,
        ticketType: m.ticket_type,
        monthlyAmount: yen(m.monthly_amount),
      };
    }),
    paidLeave: {
      daysRemaining: plbTyped?.days_remaining != null ? String(plbTyped.days_remaining) : "—",
      nextGrantYmd: nextGrantYmd ?? "—",
      nextGrantDelta: nextGrantDelta != null ? `（+${nextGrantDelta} 日）` : "",
      cacheNext: cacheNext ?? "—",
      cacheDays: cacheDays != null ? `（${cacheDays} 日）` : "",
      plbNextAccrualDate: plbTyped?.next_accrual_date ?? "—",
      plbNextAccrualDays: plbTyped?.next_accrual_days != null ? `（${plbTyped.next_accrual_days} 日）` : "",
    },
  };

  return (
    <ProfilePageTabs
      email={user.email ?? ""}
      profile={profileProps}
      hireDateLabel={hireDateLabel}
      departmentLabel={departmentLabel}
      jobTitleLabel={p?.job_title?.trim() || "—"}
      contract={contractData}
    />
  );
}
