import { ExpenseListClient } from "@/app/(app)/expenses/expense-list-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyExpensesPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("expenses")
    .select(
      "id, type, status, category, amount, paid_date, purpose, vendor, submitter_name, created_at, receipt_url, auto_approved, audit_score",
    )
    .eq("submitter_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        一覧の取得に失敗しました。DB マイグレーション（expenses テーブル）を確認してください。
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            申請状況
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            自分の経費の一覧。新規は「新規申請」から
          </p>
        </div>
        <Link
          href="/my/expenses/new"
          className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          新規申請
        </Link>
      </div>
      <ExpenseListClient initialRows={(rows ?? []) as never} />
    </div>
  );
}
