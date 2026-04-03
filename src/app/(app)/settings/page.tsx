import {
  createProductAction,
  setProductActiveAction,
  updateProductCostAction,
} from "@/app/actions/product-settings-actions";
import { FreeeLinkPanel } from "@/components/settings/freee-link-panel";
import { IncentiveRatesSettings } from "@/components/settings/incentive-rates-settings";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { resolveUserRole } from "@/lib/require-admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const companyId = (emp as { company_id?: string } | null)?.company_id;
  const role = await resolveUserRole(supabase, user.id);
  if (!isAdminRole(role) || !companyId) redirect("/my");

  const { data: coRow } = await supabase
    .from("companies")
    .select("settings, name")
    .eq("id", companyId)
    .maybeSingle();
  const tenantSettings = normalizeCompanySettings(
    (coRow as { settings?: unknown } | null)?.settings,
  );
  const approvalFlowText = tenantSettings.approval.steps
    .sort((a, b) => a.order - b.order)
    .map((s) => `${s.label}（${s.approver_role}）`)
    .join(" → ");
  const notifyText = tenantSettings.notification.channels.join("・");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, cost_price, is_active, notes")
    .eq("company_id", companyId)
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
            インセンティブ率・商品マスタ
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {role === "owner" ? (
            <Link
              href="/settings/tenant"
              className="text-sm font-medium text-violet-700 underline hover:text-violet-900 dark:text-violet-400"
            >
              会社・テナント設定 →
            </Link>
          ) : null}
          <Link
            href="/settings/export"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            データ出力
          </Link>
          <Link
            href="/settings/auto-approval"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            自動承認ルール →
          </Link>
          <Link
            href="/settings/hr"
            className="text-sm font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
          >
            HR（従業員一覧）→
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          承認フロー（このテナントの設定）
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          経費・インセンティブを含む申請の段階は、会社マスタ（companies.settings）に保存されています。差戻し時は理由が必須です。通知チャネル:{" "}
          <span className="font-medium">{notifyText || "（未設定）"}</span>
        </p>
        <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          申請者 → {approvalFlowText} → 完了
        </p>
        {(coRow as { name?: string } | null)?.name ? (
          <p className="mt-2 text-xs text-zinc-500">
            テナント: {(coRow as { name: string }).name}（<code>{companyId}</code>）
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          freee 人事労務連携
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          給与ポータル・みなし残業計算の元データを同期します。
        </p>
        <div className="mt-6">
          <FreeeLinkPanel />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          インセンティブ率（月次）
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          営業部・サービス部の対象メンバーごとにパーセント数値を保存します（
          <code className="text-xs">POST /api/settings/incentive-rates</code>）。
        </p>
        <div className="mt-6">
          <IncentiveRatesSettings />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500">商品を追加</h2>
        <form
          action={createProductAction}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
        >
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

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-500 dark:border-zinc-800">
          商品マスタ（一覧・原価）
        </h2>
        <p className="border-b border-zinc-100 px-6 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          原価は案件入力時の「実質原価」の初期値になります。廃盤は無効化してください。
        </p>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500">商品がありません。</li>
          )}
          {rows.map((_product) => (
            <li
              key={_product.id}
              className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {_product.name}
                  {!_product.is_active && (
                    <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                      無効
                    </span>
                  )}
                </p>
                {_product.notes ? (
                  <p className="text-xs text-zinc-500">{_product.notes}</p>
                ) : null}
              </div>
              <form
                action={updateProductCostAction}
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="id" value={_product.id} />
                <label className="flex items-center gap-1 text-xs text-zinc-500">
                  原価（円）
                  <input
                    name="cost_price"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={Number(_product.cost_price)}
                    className="w-28 rounded border px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-white dark:bg-zinc-200 dark:text-zinc-900"
                >
                  原価を保存
                </button>
              </form>
              <form action={setProductActiveAction}>
                <input type="hidden" name="id" value={_product.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={(!_product.is_active).toString()}
                />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                >
                  {_product.is_active ? "廃盤（無効化）" : "有効化"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
