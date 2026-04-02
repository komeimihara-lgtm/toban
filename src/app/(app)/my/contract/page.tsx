import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function MyContractPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: c } = await supabase
    .from("employment_contracts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="font-medium">契約情報が見つかりません</p>
        <p className="mt-2 text-sm">管理者にお問い合わせください。</p>
      </div>
    );
  }

  const row = c as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">契約内容（閲覧のみ）</h1>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">基本給</dt>
          <dd>{String(row.base_salary ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">みなし残業（時間・代）</dt>
          <dd>
            {String(row.deemed_overtime_hours ?? "—")} h /{" "}
            {String(row.deemed_overtime_pay ?? "—")} 円
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">通勤費・経路</dt>
          <dd>
            {String(row.commute_allowance ?? "—")} 円 — {String(row.commute_route ?? "—")}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">入社日・試用満了</dt>
          <dd>
            {String(row.hire_date ?? "—")} / {String(row.probation_end_date ?? "—")}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">次回有給付与</dt>
          <dd>
            {String(row.next_paid_leave_date ?? "—")}{" "}
            {row.next_paid_leave_days != null ? `（${String(row.next_paid_leave_days)}日）` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
