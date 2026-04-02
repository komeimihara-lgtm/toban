import { OffboardingAdminClient } from "@/components/offboarding/offboarding-admin-client";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OffboardingAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "staff";
  const companyId = (profile as { company_id?: string } | null)?.company_id;
  if (!isAdminRole(role)) redirect("/my");
  if (!companyId) redirect("/my");

  const { data: obEmps } = await supabase
    .from("employees")
    .select(
      "id, user_id, resignation_date, last_working_date, offboarding_status, scheduled_auth_deactivation_date",
    )
    .eq("company_id", companyId)
    .in("offboarding_status", ["offboarding", "left"]);

  const obRows = obEmps ?? [];
  const obIds = obRows.map((e) => (e as { id: string }).id);
  const uids = obRows.map((e) => (e as { user_id: string }).user_id);

  let ot: { employee_record_id: string; status: string }[] = [];
  if (obIds.length > 0) {
    const { data } = await supabase
      .from("offboarding_tasks")
      .select("employee_record_id, status")
      .in("employee_record_id", obIds);
    ot = (data ?? []) as typeof ot;
  }

  let profs: { id: string; full_name: string | null }[] = [];
  if (uids.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uids);
    profs = (data ?? []) as typeof profs;
  }

  const nameBy = new Map(profs.map((p) => [p.id, p.full_name]));
  const stats = new Map<string, { total: number; done: number }>();
  for (const t of ot) {
    const cur = stats.get(t.employee_record_id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.status === "completed") cur.done += 1;
    stats.set(t.employee_record_id, cur);
  }

  const rows = obRows.map((e) => {
    const er = e as {
      id: string;
      user_id: string;
      resignation_date: string | null;
      last_working_date: string | null;
      offboarding_status: string;
      scheduled_auth_deactivation_date: string | null;
    };
    const st = stats.get(er.id) ?? { total: 0, done: 0 };
    return {
      employee_record_id: er.id,
      user_id: er.user_id,
      full_name: nameBy.get(er.user_id) ?? null,
      resignation_date: er.resignation_date,
      last_working_date: er.last_working_date,
      offboarding_status: er.offboarding_status,
      scheduled_auth_deactivation_date: er.scheduled_auth_deactivation_date,
      task_total: st.total,
      task_done: st.done,
    };
  });

  const { data: activeEmps } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("company_id", companyId)
    .eq("offboarding_status", "active")
    .limit(100);

  const candUids = (activeEmps ?? []).map((x) => (x as { user_id: string }).user_id);
  let candProfs: { id: string; full_name: string | null }[] = [];
  if (candUids.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", candUids);
    candProfs = (data ?? []) as typeof candProfs;
  }
  const candName = new Map(candProfs.map((p) => [p.id, p.full_name]));

  const candidateEmployees = (activeEmps ?? []).map((e) => {
    const er = e as { id: string; user_id: string };
    return {
      id: er.id,
      full_name: candName.get(er.user_id) ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          退社手続き（管理）
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          退社フロー開始・進捗確認・最終出勤日翌日のアカウント無効化スケジュールを設定します（日次
          cron で実行）。
        </p>
      </header>
      <OffboardingAdminClient
        initialRows={rows}
        candidateEmployees={candidateEmployees}
      />
    </div>
  );
}
