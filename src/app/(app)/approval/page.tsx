import {
  approveExpenseFormAction,
  approveLeaveFormAction,
  rejectExpenseFormAction,
  rejectLeaveFormAction,
} from "@/app/actions/approval-actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminRole } from "@/types/incentive";
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

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isAdminRole((me as { role?: string })?.role ?? "")) {
    redirect("/my");
  }

  const { data: pendingExp } = await supabase
    .from("expense_claims")
    .select("*")
    .eq("status", "step1_pending")
    .order("created_at", { ascending: true });

  const { data: pendingLeave } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("status", "step1_pending")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">承認</h1>
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/approval?tab=expense"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "expense" ? "border-zinc-900 dark:border-zinc-100" : "border-transparent text-zinc-500"}`}
        >
          経費
        </Link>
        <Link
          href="/approval?tab=leave"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "leave" ? "border-zinc-900 dark:border-zinc-100" : "border-transparent text-zinc-500"}`}
        >
          有給
        </Link>
      </div>

      {tab === "expense" && (
        <ul className="space-y-4">
          {(pendingExp ?? []).length === 0 && (
            <li className="text-zinc-500">承認待ちはありません</li>
          )}
          {(pendingExp ?? []).map((e) => {
            const row = e as {
              id: string;
              amount: number;
              category: string;
              description: string | null;
              user_id: string;
            };
            return (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium">
                  {row.category} —{" "}
                  {new Intl.NumberFormat("ja-JP", {
                    style: "currency",
                    currency: "JPY",
                  }).format(Number(row.amount))}
                </p>
                <p className="text-sm text-zinc-600">{row.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveExpenseFormAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white"
                    >
                      承認
                    </button>
                  </form>
                  <form action={rejectExpenseFormAction} className="flex gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="reason"
                      required
                      placeholder="差戻し理由"
                      className="rounded border px-2 py-1 text-sm"
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

      {tab === "leave" && (
        <ul className="space-y-4">
          {(pendingLeave ?? []).length === 0 && (
            <li className="text-zinc-500">承認待ちはありません</li>
          )}
          {(pendingLeave ?? []).map((e) => {
            const row = e as {
              id: string;
              start_date: string;
              end_date: string;
              kind: string;
              reason: string | null;
            };
            return (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-sm">
                  {row.start_date} 〜 {row.end_date}（{row.kind}）
                </p>
                <p className="text-zinc-600">{row.reason}</p>
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
                      className="rounded border px-2 py-1 text-sm"
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
