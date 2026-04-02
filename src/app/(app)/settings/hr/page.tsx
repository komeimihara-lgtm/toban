import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsHrPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role ?? "")) {
    redirect("/my");
  }

  const admin = createAdminClient();
  const { data: departments } = await admin.from("departments").select("id, name").order("name");
  const { data: employees } = await admin
    .from("profiles")
    .select(
      "id, full_name, role, department_id, is_sales_target, is_service_target, is_contract, is_part_time",
    )
    .order("full_name", { ascending: true });

  const deptName = new Map(
    (departments ?? []).map((d) => [(d as { id: string }).id, (d as { name: string }).name]),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/settings" className="text-sm text-zinc-500 underline">
          ← 設定
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">HR 設定（STEP3）</h1>
        <p className="mt-1 text-sm text-zinc-600">
          従業員フラグの更新は{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">PATCH /api/settings/employees</code>、
          率は{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            POST /api/settings/incentive-rates
          </code>{" "}
          を利用してください。
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">部門</h2>
        <ul className="mt-2 text-sm">
          {(departments ?? []).map((d) => (
            <li key={(d as { id: string }).id}>
              {(d as { name: string }).name}
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
                <th className="py-2 pr-2">業務委託</th>
                <th className="py-2 pr-2">パート</th>
              </tr>
            </thead>
            <tbody>
              {(employees ?? []).map((e) => {
                const row = e as {
                  id: string;
                  full_name: string | null;
                  role: string;
                  department_id: string | null;
                  is_sales_target: boolean;
                  is_service_target: boolean;
                  is_contract: boolean;
                  is_part_time: boolean;
                };
                return (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="py-2 pr-2">{row.full_name ?? "—"}</td>
                    <td className="py-2 pr-2">{row.role}</td>
                    <td className="py-2 pr-2">
                      {row.department_id ? (deptName.get(row.department_id) ?? "—") : "—"}
                    </td>
                    <td className="py-2 pr-2">{row.is_sales_target ? "○" : "—"}</td>
                    <td className="py-2 pr-2">{row.is_service_target ? "○" : "—"}</td>
                    <td className="py-2 pr-2">{row.is_contract ? "○" : "—"}</td>
                    <td className="py-2 pr-2">{row.is_part_time ? "○" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
        <h2 className="text-sm font-medium text-amber-900 dark:text-amber-100">前月の率をコピー</h2>
        <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
          API 未実装のため、Supabase SQL または{" "}
          <code className="text-xs">incentive_rates</code> を直接複製してください。
        </p>
      </section>
    </div>
  );
}
