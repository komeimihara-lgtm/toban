"use client";

import { useMemo, useState } from "react";
import { EXPENSE_CLAIM_KINDS, type ExpenseClaimKindId } from "@/lib/expense-ui";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  previousId: string;
  defaultAmount: number;
  defaultCategory: string;
  categoryLabels: string[];
};

export function ExpenseResubmitForm({
  action,
  previousId,
  defaultAmount,
  defaultCategory,
  categoryLabels,
}: Props) {
  const [kind, setKind] = useState<ExpenseClaimKindId>("expense");
  const [amountStr, setAmountStr] = useState(String(defaultAmount));

  const amount = Number(amountStr.replace(/,/g, ""));
  const taxHint = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const net = Math.round((amount / 1.1) * 100) / 100;
    const tax = Math.round((amount - net) * 100) / 100;
    return { net, tax };
  }, [amount]);

  const selectDefault = defaultCategory || "";
  const prevCategoryCustom =
    defaultCategory && !categoryLabels.includes(defaultCategory);

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="previous_id" value={previousId} />
      <input type="hidden" name="claim_kind" value={kind} />

      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {EXPENSE_CLAIM_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-lg border px-2 py-2 text-left text-xs ${
              kind === k.id
                ? "border-red-800 bg-red-50 text-red-950"
                : "border-stone-200 bg-white"
            }`}
          >
            {k.emoji} {k.label}
          </button>
        ))}
      </div>

      <input
        name="pay_date"
        type="date"
        className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          name="amount"
          type="number"
          min={1}
          required
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="rounded border border-stone-200 px-2 py-1.5 text-sm tabular-nums"
        />
        <select
          name="category"
          required
          className="rounded border border-stone-200 px-2 py-1.5 text-sm"
          defaultValue={selectDefault}
        >
          {prevCategoryCustom ? (
            <option value={defaultCategory}>{defaultCategory}（前回）</option>
          ) : null}
          {categoryLabels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {taxHint ? (
        <p className="text-xs text-stone-600">
          税込目安: 本体約 {new Intl.NumberFormat("ja-JP").format(taxHint.net)} / 税{" "}
          {new Intl.NumberFormat("ja-JP").format(taxHint.tax)}
        </p>
      ) : null}

      <input
        name="payee"
        type="text"
        placeholder="支払先"
        className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          name="route_from"
          type="text"
          placeholder="区間・出発"
          className="rounded border border-stone-200 px-2 py-1.5 text-sm"
        />
        <input
          name="route_to"
          type="text"
          placeholder="区間・到着"
          className="rounded border border-stone-200 px-2 py-1.5 text-sm"
        />
      </div>

      <input
        name="participants"
        type="text"
        placeholder="参加者（任意）"
        className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
      />

      <textarea
        name="purpose"
        rows={2}
        required
        className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
        placeholder="修正内容・用途 *必須"
      />

      <button
        type="submit"
        className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-medium text-amber-50"
      >
        修正して再申請
      </button>
    </form>
  );
}
