import { ExpenseListClient } from "@/app/(app)/expenses/expense-list-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Camera } from "lucide-react";
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
      "id, type, status, category, amount, paid_date, purpose, vendor, submitter_name, created_at, receipt_url, auto_approved, audit_score, rejection_reason",
    )
    .eq("submitter_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          一覧の取得に失敗しました。DB マイグレーション（expenses テーブル・RLS）を確認してください。
          <span className="mt-1 block font-mono text-xs opacity-90">{error.message}</span>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          申請状況
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          自分の経費の一覧
        </p>
      </div>
      <Link
        href="/my/expenses/new"
        className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-emerald-500 text-white shadow-md transition hover:bg-emerald-400 active:scale-[0.98] active:brightness-95"
      >
        <Camera className="h-16 w-16" strokeWidth={1.65} aria-hidden />
        <span className="text-2xl font-bold tracking-tight">レシートを撮影</span>
        <span className="text-sm font-normal opacity-90">撮影してAIが自動入力</span>
      </Link>
      <ExpenseListClient initialRows={(rows ?? []) as never} />
    </div>
  );
}
