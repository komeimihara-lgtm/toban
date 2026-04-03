import {
  approveLeaveFormAction,
  rejectLeaveFormAction,
} from "@/app/actions/approval-actions";
import { ExpenseV2Approval } from "@/components/expense/expense-v2-approval";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
import { resolveUserRole } from "@/lib/require-admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "expense";
  if (!isSupabaseConfigured()) return <p>未設定</p>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveUserRole(supabase, user.id);
  if (!isAdminRole(role)) {
    redirect("/my");
  }
  let v2ExpenseRows: {
    id: string;
    status: string;
    category: string;
    amount: number;
    purpose: string;
    submitter_name: string | null;
    paid_date: string;
    audit_score: number | null;
    audit_result: unknown | null;
    audit_at: string | null;
  }[] = [];

  if (role === "approver") {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, status, category, amount, purpose, submitter_name, paid_date, audit_score, audit_result, audit_at",
      )
      .eq("status", "step1_pending")
      .order("created_at", { ascending: true });
    if (!error) v2ExpenseRows = (data ?? []) as typeof v2ExpenseRows;
  } else if (role === "owner") {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, status, category, amount, purpose, submitter_name, paid_date, audit_score, audit_result, audit_at",
      )
      .in("status", ["step1_pending", "step2_pending"])
      .order("created_at", { ascending: true });
    if (!error) {
      v2ExpenseRows = (data ?? []) as typeof v2ExpenseRows;
      v2ExpenseRows.sort((a, b) => {
        if (a.status === b.status) return 0;
        if (a.status === "step2_pending") return -1;
        if (b.status === "step2_pending") return 1;
        return 0;
      });
    }
  }

  const { data: pendingLeave } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("status", "step1_pending")
    .order("created_at", { ascending: true });

  const leaveUids = [
    ...new Set(
      (pendingLeave ?? []).map((x) => (x as { user_id: string }).user_id),
    ),
  ];
  const { data: leaveEmps } =
    leaveUids.length > 0
      ? await supabase
          .from("employees")
          .select("auth_user_id, name")
          .in("auth_user_id", leaveUids)
      : { data: [] as { auth_user_id: string; name: string | null }[] };
  const leaveNameBy = new Map(
    (leaveEmps ?? []).map((p) => {
      const r = p as { auth_user_id: string; name: string | null };
      return [r.auth_user_id, r.name?.trim() || "（無名）"] as const;
    }),
  );

  const kindLabel: Record<string, string> = {
    full: "全日",
    half: "半日",
    hour: "時間単位",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">承認</h1>
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/approval?tab=expense"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "expense"
              ? "border-zinc-900 dark:border-zinc-100"
              : "border-transparent text-zinc-500"
          }`}
        >
          経費
        </Link>
        <Link
          href="/approval?tab=leave"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "leave"
              ? "border-zinc-900 dark:border-zinc-100"
              : "border-transparent text-zinc-500"
          }`}
        >
          有給
        </Link>
      </div>

      {tab === "expense" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            経費（2段階承認）
          </h2>
          <p className="text-xs text-zinc-500">
            {role === "owner"
              ? "最終承認待ちを上に表示しています。第1承認待ちも閲覧できます。"
              : "第1承認待ちの申請のみ表示されます。"}
          </p>
          <ExpenseV2Approval rows={v2ExpenseRows} role={role} />
        </section>
      )}

      {tab === "leave" && (
        <ul className="space-y-4">
          {(pendingLeave ?? []).length === 0 && (
            <li className="text-zinc-500">承認待ちはありません</li>
          )}
          {(pendingLeave ?? []).map((e) => {
            const row = e as {
              id: string;
              user_id: string;
              start_date: string;
              end_date: string;
              kind: string;
              reason: string | null;
            };
            const who = leaveNameBy.get(row.user_id) ?? "—";
            const k = kindLabel[row.kind] ?? row.kind;
            return (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-sm font-medium">{who}</p>
                <p className="mt-1 text-sm">
                  {row.start_date} 〜 {row.end_date}（{k}）
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {row.reason?.trim() ? row.reason : "（事由なし）"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveLeaveFormAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white"
                    >
                      承認
                    </button>
                  </form>
                  <form action={rejectLeaveFormAction} className="flex gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="reason"
                      required
                      className="rounded border px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                      placeholder="差戻し理由"
                    />
                    <button
                      type="submit"
                      className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                    >
                      差戻し
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
