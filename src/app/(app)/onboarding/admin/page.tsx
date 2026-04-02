import { createClient } from "@/lib/supabase/server";
import { OnboardingAdminClient } from "@/components/onboarding/onboarding-admin-client";
import { isAdminRole } from "@/types/incentive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingAdminPage() {
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

  const { data: emps } = await supabase
    .from("employees")
    .select("id, user_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(80);

  const empRows = emps ?? [];
  const empIds = empRows.map((e) => (e as { id: string }).id);
  const userIds = empRows.map((e) => (e as { user_id: string }).user_id);

  let tasks: { employee_id: string; status: string }[] | null = [];
  if (empIds.length > 0) {
    const { data } = await supabase
      .from("onboarding_tasks")
      .select("employee_id, status")
      .in("employee_id", empIds);
    tasks = data as typeof tasks;
  }

  let profs: { id: string; full_name: string | null }[] | null = [];
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    profs = data as typeof profs;
  }

  const nameByUser = new Map<string, string | null>();
  for (const p of profs ?? ([] as { id: string; full_name: string | null }[])) {
    const row = p as { id: string; full_name: string | null };
    nameByUser.set(row.id, row.full_name);
  }

  const stats = new Map<string, { total: number; done: number }>();
  for (const t of tasks ?? []) {
    const row = t as { employee_id: string; status: string };
    const cur = stats.get(row.employee_id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (row.status === "completed") cur.done += 1;
    stats.set(row.employee_id, cur);
  }

  const rows = empRows.map((e) => {
    const er = e as { id: string; user_id: string; created_at: string };
    const st = stats.get(er.id) ?? { total: 0, done: 0 };
    return {
      employee_record_id: er.id,
      user_id: er.user_id,
      full_name: nameByUser.get(er.user_id) ?? null,
      created_at: er.created_at,
      task_total: st.total,
      task_done: st.done,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          入社手続き（管理）
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          入社予定者・新入社員のタスク進捗とリマインド送信ができます。
        </p>
      </header>
      <OnboardingAdminClient initialRows={rows} />
    </div>
  );
}
