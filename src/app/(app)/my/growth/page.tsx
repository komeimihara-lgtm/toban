import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GrowthClient } from "./growth-client";

export const dynamic = "force-dynamic";

export default async function MyGrowthPage() {
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

  // 過去6ヶ月分の目標
  const { data: goals } = await supabase
    .from("monthly_goals")
    .select("id, year, month, theme, status, ai_score, ai_evaluation, kpis, result_input")
    .eq("employee_id", profile.id)
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .limit(12);

  // 過去6ヶ月分のチェックシート
  const { data: sheets } = await supabase
    .from("check_sheets")
    .select("year, month, self_check, manager_check, status")
    .eq("employee_id", profile.id)
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .limit(12);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">成長履歴</h1>
      <GrowthClient
        goals={goals ?? []}
        sheets={sheets ?? []}
        employeeName={profile.name ?? ""}
      />
    </div>
  );
}
