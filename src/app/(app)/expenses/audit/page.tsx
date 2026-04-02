import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpensesAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "staff";
  if (!isAdminRole(role)) redirect("/my");

  const { data: claims } = await supabase
    .from("expense_claims")
    .select(
      "id, user_id, amount, category, description, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  type Row = {
    id: string;
    user_id: string;
    amount: number;
    category: string;
    description: string | null;
    status: string;
    created_at: string;
  };

  const raw = (claims ?? []) as Row[];
  const userIds = [...new Set(raw.map((r) => r.user_id))];
  let nameById: Record<string, string | null> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    nameById = Object.fromEntries(
      (profs ?? []).map((p) => [p.id as string, p.full_name as string | null]),
    );
  }
  const rows = raw.map((r) => ({
    ...r,
    submitterName: nameById[r.user_id]?.trim() || null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          経費審査・監査
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          全申請の履歴（直近80件）。承認操作は{" "}
          <Link href="/approval" className="underline">
            承認画面
          </Link>
          から行ってください。
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-2 font-medium">日付</th>
              <th className="px-4 py-2 font-medium">申請者</th>
              <th className="px-4 py-2 font-medium">区分</th>
              <th className="px-4 py-2 font-medium">金額</th>
              <th className="px-4 py-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  データがありません
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                  {new Date(r.created_at).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-2">
                  {r.submitterName || r.user_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2">{r.category}</td>
                <td className="px-4 py-2">
                  {Number(r.amount).toLocaleString("ja-JP")} 円
                </td>
                <td className="px-4 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
