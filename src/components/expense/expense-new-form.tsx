"use client";

import { useMemo, useRef, useState } from "react";
import { EXPENSE_CLAIM_KINDS, type ExpenseClaimKindId } from "@/lib/expense-ui";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categoryLabels: string[];
};

export function ExpenseNewClaimForm({ action, categoryLabels }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ExpenseClaimKindId>("expense");
  const [amountStr, setAmountStr] = useState("");

  const amount = Number(amountStr.replace(/,/g, ""));
  const taxHint = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const net = Math.round((amount / 1.1) * 100) / 100;
    const tax = Math.round((amount - net) * 100) / 100;
    return { net, tax };
  }, [amount]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="claim_kind" value={kind} />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-900/70">
          申請種別
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXPENSE_CLAIM_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                kind === k.id
                  ? "border-emerald-800 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-800/30"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              <span className="mr-1.5" aria-hidden>
                {k.emoji}
              </span>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="cursor-pointer rounded-2xl border-2 border-dashed border-emerald-800/25 bg-emerald-50/40 px-4 py-8 text-center transition hover:border-emerald-700/40"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          multiple
        />
        <p className="text-sm font-medium text-emerald-900">領収書・レシート</p>
        <p className="mt-1 text-xs text-stone-600">
          撮影・PDFを選択（保存は今後OCR連携予定。現時点では添付のみローカル）
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-stone-800">支払日</label>
          <input
            name="pay_date"
            type="date"
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-800">金額（税込・円）</label>
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm tabular-nums"
            placeholder="例: 5500"
          />
          {taxHint ? (
            <p className="mt-1 text-xs text-stone-600">
              10%込の目安: 本体約{" "}
              {new Intl.NumberFormat("ja-JP").format(taxHint.net)} 円 / 税額約{" "}
              {new Intl.NumberFormat("ja-JP").format(taxHint.tax)} 円
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-stone-800">カテゴリ</label>
        <select
          name="category"
          required
          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            選択してください
          </option>
          {categoryLabels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-stone-800">支払先・店舗名</label>
        <input
          name="payee"
          type="text"
          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="例: ○○ストア 本店"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-stone-800">区間（出発）</label>
          <input
            name="route_from"
            type="text"
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            placeholder="任意"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-800">区間（到着）</label>
          <input
            name="route_to"
            type="text"
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            placeholder="任意"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-stone-800">参加者・同席者</label>
        <input
          name="participants"
          type="text"
          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="任意（接待交際など）"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-stone-800">
          用途・メモ <span className="text-red-600">*</span>
        </label>
        <textarea
          name="purpose"
          rows={3}
          required
          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="内訳や接待の目的など"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-amber-50 shadow-sm transition hover:bg-emerald-950"
      >
        申請を提出
      </button>
    </form>
  );
}
