import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return <p>未設定</p>;
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
  const isAdmin = isAdminRole((me as { role?: string })?.role ?? "");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const { data: contract } = await supabase
    .from("employment_contracts")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  const { data: interviews } = await supabase
    .from("ai_interview_requests")
    .select("requested_at, status, risk_level, completed_at")
    .eq("employee_id", id)
    .order("requested_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/employees" className="text-sm text-blue-600 underline">
        ← 一覧
      </Link>
      <h1 className="text-2xl font-semibold">
        {(profile as { full_name?: string | null }).full_name ?? "従業員"}
      </h1>
      <p className="text-sm text-zinc-600">
        メールは Auth 管理。部署:{" "}
        {(profile as { department?: string | null }).department ?? "—"}
      </p>

      <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">雇用契約（要約）</h2>
        {contract ? (
          <dl className="mt-2 grid gap-1 text-sm">
            <dt className="text-zinc-500">基本給</dt>
            <dd>{String((contract as { base_salary?: number }).base_salary ?? "—")}</dd>
            <dt className="text-zinc-500">入社日</dt>
            <dd>{(contract as { hire_date?: string }).hire_date ?? "—"}</dd>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">未登録</p>
        )}
        {!isAdmin && <p className="mt-2 text-xs text-zinc-500">編集は管理者のみ（今後拡張）</p>}
      </section>

      <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">AI面談履歴</h2>
        <ul className="mt-2 text-sm">
          {(interviews ?? []).map((i) => (
            <li key={(i as { requested_at: string }).requested_at}>
              {(i as { status: string }).status} —{" "}
              {(i as { risk_level?: string }).risk_level ?? "—"} —{" "}
              {(i as { completed_at?: string }).completed_at ??
                (i as { requested_at: string }).requested_at}
            </li>
          ))}
          {!interviews?.length && <li className="text-zinc-500">なし</li>}
        </ul>
      </section>
    </div>
  );
}
