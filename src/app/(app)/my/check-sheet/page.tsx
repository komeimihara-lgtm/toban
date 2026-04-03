import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckSheetClient } from "./check-sheet-client";

export const dynamic = "force-dynamic";

export default async function MyCheckSheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = emp as { id: string; role: string; company_id: string } | null;
  if (!profile?.company_id) redirect("/my");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: sheet } = await supabase
    .from("check_sheets")
    .select("*")
    .eq("employee_id", profile.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">チェックシート</h1>
      <CheckSheetClient
        currentSheet={sheet}
        year={year}
        month={month}
      />
    </div>
  );
}
