import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isAdminRole((me as { role?: string })?.role ?? "")) redirect("/my");

  let qy = supabase.from("profiles").select("id, full_name, department, is_sales_target, is_service_target").order("full_name");
  if (sp.q?.trim()) {
    qy = qy.ilike("full_name", `%${sp.q.trim()}%`);
  }
  if (sp.dept?.trim()) {
    qy = qy.eq("department", sp.dept.trim());
  }
  const { data: rows } = await qy;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">従業員管理</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          placeholder="名前検索"
          defaultValue={sp.q}
          className="rounded border px-2 py-1"
        />
        <input
          name="dept"
          placeholder="部署"
          defaultValue={sp.dept}
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-zinc-800 px-3 py-1 text-white">
          絞込
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">名前</th>
            <th>部署</th>
            <th>インセンティブ</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => {
            const row = r as {
              id: string;
              full_name: string | null;
              department: string | null;
              is_sales_target: boolean;
              is_service_target: boolean;
            };
            const inc =
              row.is_sales_target || row.is_service_target ? "対象" : "—";
            return (
              <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2">
                  <Link href={`/employees/${row.id}`} className="text-blue-600 underline">
                    {row.full_name ?? "（無名）"}
                  </Link>
                </td>
                <td>{row.department ?? "—"}</td>
                <td>{inc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
