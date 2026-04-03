import { EmployeeIncentiveCell } from "@/components/employees/employee-incentive-cell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getNextGrantDate,
  ymdJst,
} from "@/lib/paid-leave";
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
  if (!isAdminRole(role) || !companyId) {
    redirect("/my");
  }

  let employeesQy = supabase
    .from("employees")
    .select("id, name, department_id, is_sales_target, is_service_target")
    .eq("company_id", companyId)
    .order("name");
  if (sp.q?.trim()) {
    employeesQy = employeesQy.ilike("name", `%${sp.q.trim()}%`);
  }
  if (sp.dept?.trim()) {
    employeesQy = employeesQy.eq("department_id", sp.dept.trim());
  }

  const [{ data: departments }, { data: employees }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("company_id", companyId),
    employeesQy,
  ]);

  const deptName = new Map(
    (departments ?? []).map((d) => [(d as { id: string }).id, (d as { name: string }).name]),
  );

  const [{ data: contracts }, { data: grants }, { data: commutes }] =
    await Promise.all([
      supabase
        .from("employment_contracts")
        .select(
          "employee_id, employment_type, start_date, hire_date, is_active",
        )
        .eq("company_id", companyId),
      supabase
        .from("paid_leave_grants")
        .select("employee_id, days_remaining, expires_at")
        .eq("company_id", companyId),
      supabase
        .from("commute_expenses")
        .select("employee_id")
        .eq("company_id", companyId)
        .eq("is_active", true),
    ]);

  const today = ymdJst(new Date());
  const contractBy = new Map<
    string,
    {
      employment_type: string | null;
      start_date: string | null;
      hire_date: string | null;
      is_active: boolean | null;
    }
  >();
  for (const c of contracts ?? []) {
    const row = c as {
      employee_id: string;
      employment_type: string | null;
      start_date: string | null;
      hire_date: string | null;
      is_active: boolean | null;
    };
    contractBy.set(row.employee_id, row);
  }

  const leaveRemain = new Map<string, number>();
  for (const g of grants ?? []) {
    const row = g as {
      employee_id: string;
      days_remaining: number;
      expires_at: string | null;
    };
    if (row.expires_at && row.expires_at < today) continue;
    leaveRemain.set(
      row.employee_id,
      (leaveRemain.get(row.employee_id) ?? 0) + Number(row.days_remaining ?? 0),
    );
  }

  const commuteCount = new Map<string, number>();
  for (const x of commutes ?? []) {
    const id = (x as { employee_id: string }).employee_id;
    commuteCount.set(id, (commuteCount.get(id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">従業員一覧</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          placeholder="名前検索"
          defaultValue={sp.q}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-card"
        />
        <input
          name="dept"
          placeholder="部署（テキスト）"
          defaultValue={sp.dept}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-card"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          絞込
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-card">
            <tr>
              <th className="px-3 py-2">名前</th>
              <th className="px-3 py-2">部署</th>
              <th className="px-3 py-2">入社日</th>
              <th className="px-3 py-2">有給残（概算）</th>
              <th className="px-3 py-2">次回有給付与日</th>
              <th className="px-3 py-2">通勤費</th>
              <th className="px-3 py-2">インセンティブ対象</th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((r) => {
              const row = r as {
                id: string;
                name: string | null;
                department_id: string | null;
                is_sales_target: boolean;
                is_service_target: boolean;
              };
              const ctr = contractBy.get(row.id);
              const startYmd = ctr?.start_date ?? ctr?.hire_date ?? null;
              let nextGrant: string | null = null;
              if (startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
                const d = getNextGrantDate(
                  new Date(`${startYmd}T12:00:00+09:00`),
                );
                nextGrant = d ? ymdJst(d) : null;
              }
              const hire =
                ctr?.start_date ?? ctr?.hire_date ?? "—";
              const cc = commuteCount.get(row.id) ?? 0;
              return (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/employees/${row.id}`}
                      className="font-medium text-emerald-700 underline dark:text-emerald-400"
                    >
                      {row.name ?? "（無名）"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.department_id ? (deptName.get(row.department_id) ?? "—") : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{hire}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {Math.round((leaveRemain.get(row.id) ?? 0) * 100) / 100} 日
                  </td>
                  <td className="px-3 py-2 tabular-nums">{nextGrant ?? "—"}</td>
                  <td className="px-3 py-2">
                    {cc > 0 ? `登録 ${cc}` : "未登録"}
                  </td>
                  <td className="px-3 py-2">
                    <EmployeeIncentiveCell
                      employeeId={row.id}
                      isSales={row.is_sales_target}
                      isService={row.is_service_target}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
