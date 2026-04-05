import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfilePageTabs } from "./profile-page-tabs";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const p = emp as {
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
    birth_date?: string | null;
    emergency_contact?: string | null;
    emergency_name?: string | null;
    emergency_relation?: string | null;
    line_user_id?: string | null;
    department?: string | null;
    department_id?: string | null;
  } | null;

  let departmentLabel = "—";
  const depId = p?.department_id;
  if (depId) {
    const { data: depRow } = await supabase
      .from("departments")
      .select("name")
      .eq("id", depId)
      .maybeSingle();
    const masterName = (depRow as { name?: string | null } | null)?.name?.trim();
    departmentLabel = masterName || p?.department?.trim() || "—";
  } else if (p?.department?.trim()) {
    departmentLabel = p.department.trim();
  }

  const bdRaw = p?.birth_date;
  const bd = typeof bdRaw === "string" ? bdRaw.trim() : null;

  const profileProps = {
    full_name: p?.full_name?.trim() ?? "",
    phone: p?.phone?.trim() ?? "",
    address: p?.address?.trim() ?? "",
    birth_date: bd && bd.length >= 10 ? bd.slice(0, 10) : bd ?? "",
    emergency_name: p?.emergency_name?.trim() ?? "",
    emergency_relation: p?.emergency_relation?.trim() ?? "",
    emergency_contact: p?.emergency_contact?.trim() ?? "",
    line_user_id: p?.line_user_id?.trim() ?? "",
  };

  return (
    <ProfilePageTabs
      email={user.email ?? ""}
      profile={profileProps}
      departmentLabel={departmentLabel}
    />
  );
}
