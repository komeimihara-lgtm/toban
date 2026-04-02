import { ExpenseListClient } from "./expense-list-client";
import { checkAdminRole } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    redirect("/my/expenses");
  }

  const { data: rows, error } = await supabase
    .from("expenses")
    .select(
      "id, type, status, category, amount, paid_date, purpose, vendor, submitter_name, created_at, receipt_url",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        一覧の取得に失敗しました。DB マイグレーション（expenses テーブル）を適用してください。
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">経費・申請一覧</h1>
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
