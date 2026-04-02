import { ShiftWeekClient } from "@/components/attendance/shift-week-client";
import { checkAdminRole } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AttendanceShiftPage() {
  if (!isSupabaseConfigured()) return <p>Supabase 未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkAdminRole(supabase, user.id))) {
    redirect("/my/attendance");
  }
  return <ShiftWeekClient />;
}
