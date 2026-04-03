import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { checkAdminRole } from "@/lib/require-admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-500">Supabase を設定してください。</p>;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkAdminRole(supabase, user.id))) {
    redirect("/my");
  }

  return <AdminDashboard />;
}
