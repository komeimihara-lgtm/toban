import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
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

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "staff";

  if (!isAdminRole(role)) {
    redirect("/my");
  }

  return <AdminDashboard />;
}
