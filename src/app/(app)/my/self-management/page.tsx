import { SelfManagementTabs, type SelfManagementTabSlug } from "./self-management-tabs";
import { getSheetType } from "@/app/(app)/my/check-sheet/sheet-definitions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): SelfManagementTabSlug {
  if (raw === "check" || raw === "growth") return raw;
  return "goals";
}

export default async function SelfManagementPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ tab?: string }>;
}>) {
  const sp = await searchParams;
  const initialSlug = parseTab(sp.tab);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role, company_id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = emp as {
    id: string;
    role: string;
    company_id: string;
    name: string | null;
  } | null;
  if (!profile?.company_id) redirect("/my");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const employeeName = profile.name ?? "";

  const sheetType = getSheetType(employeeName);

  const [{ data: goal }, { data: history }, { data: sheet }, { data: growthGoals }, { data: growthSheets }] =
    await Promise.all([
      supabase
        .from("monthly_goals")
        .select("*")
        .eq("employee_id", profile.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
      supabase
        .from("monthly_goals")
        .select("id, year, month, theme, status, ai_score, kpis, result_input")
        .eq("employee_id", profile.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(6),
      supabase
        .from("check_sheets")
        .select("*")
        .eq("employee_id", profile.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
      supabase
        .from("monthly_goals")
        .select("id, year, month, theme, status, ai_score, ai_evaluation, kpis, result_input")
        .eq("employee_id", profile.id)
        .order("year", { ascending: true })
        .order("month", { ascending: true })
        .limit(12),
      supabase
        .from("check_sheets")
        .select("year, month, self_check, manager_check, status")
        .eq("employee_id", profile.id)
        .order("year", { ascending: true })
        .order("month", { ascending: true })
        .limit(12),
    ]);

  return (
    <SelfManagementTabs
      initialSlug={initialSlug}
      goals={{
        currentGoal: goal,
        history: history ?? [],
        year,
        month,
        employeeName,
      }}
      checkSheet={{
        currentSheet: sheet,
        year,
        month,
        sheetType,
        employeeName,
      }}
      growth={{
        goals: growthGoals ?? [],
        sheets: growthSheets ?? [],
        employeeName,
      }}
    />
  );
}
