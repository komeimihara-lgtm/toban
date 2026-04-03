import { CompanyTenantSettings } from "@/components/settings/company-tenant-settings";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyPlan } from "@/types/index";
import Link from "next/link";
import { redirect } from "next/navigation";

type DeptRow = { id: string; name: string; incentive_enabled: boolean };
type EmpRow = { id: string; name: string | null; role: string; department_id: string | null; is_sales_target: boolean; is_service_target: boolean };

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

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, incentive_enabled")
    .eq("company_id", pr.company_id)
    .order("name");
  const { data: empRows } = await supabase
    .from("employees")
    .select("id, name, role, department_id, is_sales_target, is_service_target")
    .eq("company_id", pr.company_id)
    .order("name");

  const deptList = (departments ?? []) as DeptRow[];
  const empList = (empRows ?? []) as EmpRow[];
  const deptName = new Map(deptList.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-8">
      <Link href="/settings" className="text-sm text-zinc-500 underline">
        ← 設定
      </Link>
      <CompanyTenantSettings initialCompany={company} />

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">部門・インセンティブ対象</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {deptList.map((d) => (
            <li key={d.id}>
              {d.name}
              {d.incentive_enabled ? (
                <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">インセンティブ対象</span>
              ) : (
                <span className="ml-2 text-xs text-zinc-500">対象外</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">従業員一覧（確認）</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-2">氏名</th>
                <th className="py-2 pr-2">role</th>
                <th className="py-2 pr-2">部門</th>
                <th className="py-2 pr-2">営業対象</th>
                <th className="py-2 pr-2">ｻｰﾋﾞｽ対象</th>
              </tr>
            </thead>
            <tbody>
              {empList.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="py-2 pr-2">{row.name ?? "—"}</td>
                  <td className="py-2 pr-2">{row.role}</td>
                  <td className="py-2 pr-2">{row.department_id ? (deptName.get(row.department_id) ?? "—") : "—"}</td>
                  <td className="py-2 pr-2">{row.is_sales_target ? "○" : "—"}</td>
                  <td className="py-2 pr-2">{row.is_service_target ? "○" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
