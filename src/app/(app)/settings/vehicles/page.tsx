import { VehicleAdminClient } from "@/components/vehicles/vehicle-admin-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveUserRole } from "@/lib/require-admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsVehiclesPage() {
  if (!isSupabaseConfigured()) return <p className="text-sm text-zinc-500">Supabase 未設定</p>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveUserRole(supabase, user.id);
  if (role !== "owner" && role !== "director") redirect("/my");

  const { data: emp } = await supabase
    .from("employees")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const companyId = (emp as { company_id?: string } | null)?.company_id;
  if (!companyId) redirect("/my");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .order("branch")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">車両管理</h1>
        <p className="mt-1 text-sm text-zinc-400">社用車の追加・編集・無効化</p>
      </header>
      <VehicleAdminClient
        initialVehicles={
          (vehicles ?? []) as {
            id: string;
            name: string;
            plate_number: string | null;
            branch: string;
            is_active: boolean;
          }[]
        }
      />
    </div>
  );
}
