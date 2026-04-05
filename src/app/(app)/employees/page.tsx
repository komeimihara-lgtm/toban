import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: me } = await supabase
    .from("employees")
    .select("company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me) {
    const alt = await supabase
      .from("employees")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    me = alt.data;
  }
  const companyId = (me as { company_id?: string })?.company_id;
  const role = (me as { role?: string })?.role ?? "staff";
  if (role !== "owner" || !companyId) {
    redirect("/my");
  }

  let employeesQy = supabase
    .from("employees")
    .select("id, name, role, department_id")
    .eq("company_id", companyId)
    .order("name");
  if (sp.q?.trim()) {
    employeesQy = employeesQy.ilike("name", `%${sp.q.trim()}%`);
  }

  const [{ data: departments }, { data: employees }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("company_id", companyId),
    employeesQy,
  ]);

  const deptName = new Map(
    (departments ?? []).map((d) => [(d as { id: string }).id, (d as { name: string }).name]),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">スタッフ一覧</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          placeholder="名前検索"
          defaultValue={sp.q}
          className="rounded border border-zinc-300 px-2 py-1"
        />
        <button
          type="submit"
          className="rounded bg-[#FF6B2B] px-3 py-1 text-white hover:bg-[#FF8C00]"
        >
          検索
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
            <tr>
              <th className="px-3 py-2">名前</th>
              <th className="px-3 py-2">部署</th>
              <th className="px-3 py-2">ロール</th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((r) => {
              const row = r as {
                id: string;
                name: string | null;
                department_id: string | null;
                role: string;
              };
              return (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/employees/${row.id}`}
                      className="font-medium text-emerald-700 underline"
                    >
                      {row.name ?? "（無名）"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.department_id ? (deptName.get(row.department_id) ?? "—") : "—"}</td>
                  <td className="px-3 py-2">{row.role}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
