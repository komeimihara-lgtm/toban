import { ExpenseApiForm } from "@/components/expense/expense-api-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function MyExpensesNewPage() {
  if (!isSupabaseConfigured()) return <p>未設定</p>;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">経費・新規申請</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          申請後は千葉（第1承認）→ 代表（最終承認）の順です。差戻し時は理由が必須です。
        </p>
      </div>

      <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <p className="font-medium text-emerald-950 dark:text-emerald-100">承認フロー（全拠点共通）</p>
        <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
          <li className="font-medium text-zinc-800 dark:text-zinc-200">申請者</li>
          <li className="hidden text-zinc-400 sm:block" aria-hidden>
            →
          </li>
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">千葉</span>
            <span className="text-zinc-500 dark:text-zinc-400">（第1承認）</span>
          </li>
          <li className="hidden text-zinc-400 sm:block" aria-hidden>
            →
          </li>
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">三原孔明</span>
            <span className="text-zinc-500 dark:text-zinc-400">（最終承認）</span>
          </li>
        </ol>
      </section>

      <ExpenseApiForm />
    </div>
  );
}
