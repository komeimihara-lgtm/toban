import {
  createExpenseClaim,
  resubmitExpenseClaim,
} from "@/app/actions/expense-actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

const expenseFlash: Record<string, string> = {
  ok: "申請を受け付けました。",
  ok_resubmit: "再申請を受け付けました。",
  e_input: "入力内容を確認してください。",
  e_save: "登録に失敗しました。",
  e_prev: "対象の申請が見つかりません。",
  e_status: "差戻しされた申請のみ再申請できます。",
  e_resubmit: "再申請の保存に失敗しました。",
};

export default async function MyExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ expense?: string }>;
}) {
  const sp = await searchParams;
  const expenseKey = sp.expense ?? "";
  const expenseNotice = expenseKey ? expenseFlash[expenseKey] : null;

  if (!isSupabaseConfigured()) {
    return <p>Supabase 未設定</p>;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("expense_claims")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">経費申請・申請状況</h1>

      {expenseNotice && (
        <p
          className={
            expenseKey.startsWith("e_")
              ? "rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
              : "rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          }
        >
          {expenseNotice}
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">新規申請</h2>
        <form action={createExpenseClaim} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">金額（円）</label>
            <input
              name="amount"
              type="number"
              required
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium">カテゴリ</label>
            <input
              name="category"
              required
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="交通費 など"
            />
          </div>
          <div>
            <label className="text-sm font-medium">内容</label>
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            申請する
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-500">一覧</h2>
        <ul className="mt-3 space-y-4">
          {(rows ?? []).map((r) => {
            const row = r as {
              id: string;
              amount: number;
              category: string;
              status: string;
              reject_reason: string | null;
            };
            return (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{row.category}</span>
                  <span>
                    {new Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "JPY",
                    }).format(Number(row.amount))}
                  </span>
                  <span className="text-zinc-500">{row.status}</span>
                </div>
                {row.status === "rejected" && (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
                    <p className="font-medium text-red-800 dark:text-red-200">差戻し</p>
                    <p className="text-red-700 dark:text-red-300">
                      {row.reject_reason ?? "理由なし"}
                    </p>
                    <form action={resubmitExpenseClaim} className="mt-3 space-y-2">
                      <input type="hidden" name="previous_id" value={row.id} />
                      <input
                        name="amount"
                        type="number"
                        required
                        defaultValue={Number(row.amount)}
                        className="w-full rounded border px-2 py-1"
                      />
                      <input
                        name="category"
                        required
                        defaultValue={row.category}
                        className="w-full rounded border px-2 py-1"
                      />
                      <textarea
                        name="description"
                        rows={2}
                        className="w-full rounded border px-2 py-1 text-sm"
                        placeholder="修正内容の説明"
                      />
                      <button
                        type="submit"
                        className="rounded bg-zinc-800 px-3 py-1.5 text-white text-xs"
                      >
                        修正して再申請
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
