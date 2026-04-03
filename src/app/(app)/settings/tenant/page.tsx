import { CompanyTenantSettings } from "@/components/settings/company-tenant-settings";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyPlan } from "@/types/index";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsTenantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const pr = emp as { role?: string; company_id?: string } | null;
  if (pr?.role !== "owner" || !pr.company_id) {
    redirect("/settings");
  }

  const { data: row, error } = await supabase
    .from("companies")
    .select("id, name, plan, settings, created_at")
    .eq("id", pr.company_id)
    .single();
  if (error || !row) {
    return (
      <p className="text-sm text-red-600">
        会社情報を読み込めませんでした。
      </p>
    );
  }

  const r = row as {
    id: string;
    name: string;
    plan: string;
    settings: unknown;
    created_at: string;
  };
  const plan: CompanyPlan =
    r.plan === "starter" || r.plan === "pro" ? r.plan : "free";
  const company: Company = {
    id: r.id,
    name: r.name,
    plan,
    settings: normalizeCompanySettings(r.settings),
    created_at: r.created_at,
  };

  return (
    <div>
      <Link href="/settings" className="text-sm text-zinc-500 underline">
        ← 設定
      </Link>
      <CompanyTenantSettings initialCompany={company} />
    </div>
  );
}
