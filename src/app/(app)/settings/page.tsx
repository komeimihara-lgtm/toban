import {
  createProductAction,
  setProductActiveAction,
} from "@/app/actions/product-settings-actions";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMPANY_ID } from "@/lib/company";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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

  const { data: products } = await supabase
    .from("products")
    .select("id, name, cost_price, is_active, notes")
    .eq("company_id", DEFAULT_COMPANY_ID)
    .order("name");

  const rows = (products ?? []) as {
    id: string;
    name: string;
    cost_price: number;
    is_active: boolean;
    notes: string | null;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            設定
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            商品マスタ（インセンティブ案件の選択肢）
          </p>
        </div>
        <Link
          href="/settings/auto-approval"
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          自動承認ルール →
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">商品を追加</h2>
        <form action={createProductAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            name="name"
            required
            placeholder="商品名"
            className="min-w-[12rem] flex-1 rounded border px-3 py-2 text-sm dark:bg-zinc-900"
          />
          <input
            name="cost_price"
            type="number"
            step="1"
            min="0"
            placeholder="原価"
            className="w-32 rounded border px-3 py-2 text-sm dark:bg-zinc-900"
          />
          <input
            name="notes"
            placeholder="メモ（任意）"
            className="min-w-[12rem] flex-1 rounded border px-3 py-2 text-sm dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            追加
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-500 dark:border-zinc-800">
          登録済み
        </h2>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500">商品がありません。</li>
          )}
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {p.name}
                  {!p.is_active && (
                    <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                      無効
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  原価: {Number(p.cost_price).toLocaleString("ja-JP")} 円
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <form action={setProductActiveAction}>
                <input type="hidden" name="id" value={p.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={(!p.is_active).toString()}
                />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                >
                  {p.is_active ? "無効化" : "有効化"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
