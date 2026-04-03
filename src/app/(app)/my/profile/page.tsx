import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

function formatDateJa(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*") で存在しないカラム指定によるクエリ失敗を回避
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("[profile] employee query:", {
    userId: user.id,
    hasData: !!emp,
    error: empError?.message ?? null,
    full_name: emp?.full_name ?? "(missing)",
    phone: emp?.phone ?? "(missing)",
    birth_date: emp?.birth_date ?? "(missing)",
  });

  const p = emp as {
    id?: string;
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
    emergency_contact?: string | null;
    emergency_name?: string | null;
    emergency_relation?: string | null;
    birth_date?: string | null;
    line_user_id?: string | null;
    department?: string | null;
    job_title?: string | null;
    department_id?: string | null;
  } | null;

  // 部署名の解決
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

  // 入社日
  let hireDateLabel = "—";
  const empId = p?.id;
  if (empId) {
    const { data: contract } = await supabase
      .from("employment_contracts")
      .select("hire_date, start_date")
      .eq("employee_id", empId)
      .maybeSingle();
    const c = contract as { hire_date?: string | null; start_date?: string | null } | null;
    hireDateLabel = formatDateJa(c?.hire_date ?? c?.start_date ?? null);
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

  console.log("[profile] props to form:", profileProps);

  return (
    <ProfileForm
      email={user.email ?? ""}
      profile={profileProps}
      hireDateLabel={hireDateLabel}
      departmentLabel={departmentLabel}
      jobTitleLabel={p?.job_title?.trim() || "—"}
    />
  );
}
