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

const EMP_LABEL: Record<string, string> = {
  full_time: "正社員",
  part_time: "短時間勤務",
  contract: "契約",
  dispatch: "派遣",
};

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
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  const companyId = (me as { company_id?: string })?.company_id;
  if (!isAdminRole((me as { role?: string })?.role ?? "") || !companyId) {
    redirect("/my");
  }

  let qy = supabase
    .from("profiles")
    .select("id, full_name, department, department_id, is_sales_target, is_service_target")
    .eq("company_id", companyId)
    .order("full_name");
  if (sp.q?.trim()) {
    qy = qy.ilike("full_name", `%${sp.q.trim()}%`);
  }
  if (sp.dept?.trim()) {
    qy = qy.eq("department", sp.dept.trim());
  }
  const { data: profiles } = await qy;

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
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
        />
        <input
          name="dept"
          placeholder="部署（テキスト）"
          defaultValue={sp.dept}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
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
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2">名前</th>
              <th className="px-3 py-2">部署</th>
              <th className="px-3 py-2">雇用区分</th>
              <th className="px-3 py-2">有給残（概算）</th>
              <th className="px-3 py-2">次回有給付与日</th>
              <th className="px-3 py-2">通勤費</th>
              <th className="px-3 py-2">インセンティブ</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((r) => {
              const row = r as {
                id: string;
                full_name: string | null;
                department: string | null;
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
              const empType = ctr?.employment_type
                ? EMP_LABEL[ctr.employment_type] ?? ctr.employment_type
                : "—";
              const inc =
                row.is_sales_target || row.is_service_target ? "対象" : "—";
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
                      {row.full_name ?? "（無名）"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.department ?? "—"}</td>
                  <td className="px-3 py-2">{empType}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {Math.round((leaveRemain.get(row.id) ?? 0) * 100) / 100} 日
                  </td>
                  <td className="px-3 py-2 tabular-nums">{nextGrant ?? "—"}</td>
                  <td className="px-3 py-2">
                    {cc > 0 ? `登録 ${cc}` : "未登録"}
                  </td>
                  <td className="px-3 py-2">{inc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
