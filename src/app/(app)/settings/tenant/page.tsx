import { CompanyTenantSettings } from "@/components/settings/company-tenant-settings";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, name, settings")
    .eq("id", pr.company_id)
    .single();
  if (error || !row) {
    return (
      <p className="text-sm text-red-600">
        店舗情報を読み込めませんでした。
      </p>
    );
  }

  const r = row as {
    id: string;
    name: string;
    settings: unknown;
  };

  const company = {
    id: r.id,
    name: r.name,
    settings: normalizeCompanySettings(r.settings),
  };

  return (
    <div className="space-y-8">
      <Link href="/settings" className="text-sm text-zinc-500 underline">
        ← 設定
      </Link>
      <CompanyTenantSettings initialCompany={company} />
    </div>
  );
}
