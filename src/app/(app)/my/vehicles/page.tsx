import { VehicleReservationClient } from "@/components/vehicles/vehicle-reservation-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyVehiclesPage() {
  if (!isSupabaseConfigured()) return <p className="text-sm text-zinc-500">Supabase 未設定</p>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!emp) redirect("/login");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", emp.company_id)
    .eq("is_active", true)
    .order("branch")
    .order("name");

  return (
    <VehicleReservationClient
      userId={user.id}
      userRole={(emp.role as string) ?? "staff"}
      vehicles={(vehicles ?? []) as { id: string; name: string; plate_number: string | null; branch: string }[]}
    />
  );
}
