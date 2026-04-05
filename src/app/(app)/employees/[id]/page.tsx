import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "staff";
  const companyId = (me as { company_id?: string } | null)?.company_id;
  if (role !== "owner" || !companyId) redirect("/my");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, name, role, department_id, email, line_user_id, is_active")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!emp) notFound();

  const row = emp as {
    id: string;
    name: string | null;
    role: string;
    department_id: string | null;
    email: string | null;
    line_user_id: string | null;
    is_active: boolean;
  };

  let deptName = "—";
  if (row.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("name")
      .eq("id", row.department_id)
      .maybeSingle();
    deptName = (dept as { name?: string } | null)?.name ?? "—";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/employees" className="text-sm text-zinc-500 underline">
        ← スタッフ一覧
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {row.name ?? "（無名）"}
      </h1>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-card">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">ロール</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{row.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">部署</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{deptName}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">メール</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{row.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">LINE</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.line_user_id ? "連携済み" : "未連携"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">ステータス</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.is_active ? "有効" : "無効"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
