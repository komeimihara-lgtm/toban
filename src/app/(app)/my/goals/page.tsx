import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GoalsClient } from "./goals-client";

export const dynamic = "force-dynamic";

export default async function MyGoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role, company_id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = emp as { id: string; role: string; company_id: string; name: string | null } | null;
  if (!profile?.company_id) redirect("/my");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: goal } = await supabase
    .from("monthly_goals")
    .select("*")
    .eq("employee_id", profile.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  // 過去6ヶ月分
  const { data: history } = await supabase
    .from("monthly_goals")
    .select("id, year, month, theme, status, ai_score, kpis, result_input")
    .eq("employee_id", profile.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">月間目標・KPI</h1>
      <GoalsClient
        currentGoal={goal}
        history={history ?? []}
        year={year}
        month={month}
        employeeName={profile.name ?? ""}
      />
    </div>
  );
}
