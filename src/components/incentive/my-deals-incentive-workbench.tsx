"use client";

import { DEAL_MACHINE_TYPES, buildDealComputed, ratesFromDbRows } from "@/lib/deals-compute";
import { useCallback, useEffect, useMemo, useState } from "react";

type DealRow = {
  id: string;
  year: number;
  month: number;
  salon_name: string;
  machine_type: string;
  cost_price: number;
  sale_price: number;
  payment_method: string;
  payment_date: string | null;
  net_profit: number;
  appo_incentive: number;
  closer_incentive: number;
  payment_status: string;
  submit_status: string;
  submitted_by: string | null;
  approved_by: string | null;
  reject_reason: string | null;
  appo_employee_id: string | null;
  closer_employee_id: string | null;
  notes: string | null;
};

type RateRow = { machine_type: string; role: string; rate: number };

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function pad2(m: number) {
  return String(m).padStart(2, "0");
}

export function MyDealsIncentiveWorkbench(props: { userId: string; userName: string | null }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"input" | "history">("input");

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [rateRows, setRateRows] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    salon_name: "",
    machine_type: DEAL_MACHINE_TYPES[0] as string,
    cost_price: "",
    sale_price: "",
    payment_method: "",
    payment_date: "",
    notes: "",
    is_appo: true,
    is_closer: false,
  });

  const loadRates = useCallback(async () => {
    const res = await fetch("/api/deal-incentive-rates");
    const j = (await res.json()) as { rates?: RateRow[] };
    setRateRows(
      (j.rates ?? []).map((r) => ({
        machine_type: r.machine_type,
        role: r.role,
        rate: Number(r.rate),
      })),
    );
  }, []);

  const loadDeals = useCallback(async () => {
    const res = await fetch(`/api/deals?year=${year}&month=${month}`);
    const j = (await res.json()) as { deals?: DealRow[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? "読み込み失敗");
    setDeals((j.deals ?? []) as DealRow[]);
  }, [year, month]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMsg(null);
      try {
        await loadDeals();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "エラー");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDeals]);

  const draftDeals = useMemo(
    () => deals.filter((d) => d.submit_status === "draft" || d.submit_status === "rejected"),
    [deals],
  );

  const historyDeals = useMemo(
    () => deals.filter((d) => ["submitted", "approved", "rejected"].includes(d.submit_status)),
    [deals],
  );

  const approvedMonthTotal = useMemo(
    () =>
      deals
        .filter((d) => d.submit_status === "approved")
        .reduce((sum, d) => {
          let s = 0;
          if (d.appo_employee_id === props.userId) s += d.appo_incentive;
          if (d.closer_employee_id === props.userId) s += d.closer_incentive;
          return sum + s;
        }, 0),
    [deals, props.userId],
  );

  const preview = useMemo(() => {
    const sp = Number(form.sale_price);
    const cp = Number(form.cost_price);
    if (!Number.isFinite(sp) || !Number.isFinite(cp)) return null;
    const rows = rateRows.filter((r) => r.machine_type === form.machine_type);
    const rates = ratesFromDbRows(rows);
    return buildDealComputed(sp, cp, rates, {
      appoEmployeeId: form.is_appo ? props.userId : null,
      closerEmployeeId: form.is_closer ? props.userId : null,
    });
  }, [form, rateRows, props.userId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      salon_name: "",
      machine_type: DEAL_MACHINE_TYPES[0],
      cost_price: "",
      sale_price: "",
      payment_method: "",
      payment_date: "",
      notes: "",
      is_appo: true,
      is_closer: false,
    });
    setModalOpen(true);
  };

  const openEdit = (d: DealRow) => {
    if (d.submit_status !== "draft" && d.submit_status !== "rejected") return;
    setEditingId(d.id);
    setForm({
      salon_name: d.salon_name,
      machine_type: (DEAL_MACHINE_TYPES as readonly string[]).includes(d.machine_type)
        ? d.machine_type
        : (DEAL_MACHINE_TYPES[0] as string),
      cost_price: String(d.cost_price),
      sale_price: String(d.sale_price),
      payment_method: d.payment_method,
      payment_date: d.payment_date ? d.payment_date.slice(0, 10) : "",
      notes: d.notes ?? "",
      is_appo: d.appo_employee_id === props.userId,
      is_closer: d.closer_employee_id === props.userId,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const saveDraft = async () => {
    if (!form.is_appo && !form.is_closer) {
      setMsg("アポまたはクローザーのいずれかにチェックを入れてください");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        year,
        month,
        salon_name: form.salon_name,
        machine_type: form.machine_type,
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
        payment_method: form.payment_method,
        payment_date: form.payment_date || null,
        payment_status: "pending",
        notes: form.notes || null,
        is_appo: form.is_appo,
        is_closer: form.is_closer,
      };
      const url = editingId ? `/api/deals/${editingId}` : "/api/deals";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "保存に失敗しました");
      closeModal();
      await loadDeals();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存エラー");
    } finally {
      setSaving(false);
    }
  };

  const submitDeal = async (id: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/deals/${id}/submit`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "提出に失敗しました");
      await loadDeals();
      setMsg("提出しました。承認をお待ちください。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提出エラー");
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!confirm("この下書きを削除しますか？")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "削除に失敗しました");
      await loadDeals();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "削除エラー");
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "draft") return "下書き";
    if (s === "submitted") return "承認待ち";
    if (s === "approved") return "承認済み";
    if (s === "rejected") return "差戻し";
    return s;
  };

  return (
    <div className="space-y-6">
      {msg ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <label className="block text-xs text-zinc-500">年</label>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">月</label>
          <select
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {pad2(m)}月
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["input", "案件入力"],
            ["history", "提出済み・履歴"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "border-b-2 border-zinc-900 px-3 py-2 text-sm font-medium dark:border-zinc-100"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : tab === "input" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              新規案件
            </button>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {props.userName ?? "あなた"} さんがアポまたはクローザーとして関与する案件を登録できます。保存は下書き、確認後に「提出」してください。
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {["サロン", "機種", "純利益", "アポ¥", "クローザー¥", "状態", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {draftDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      下書き・差戻しの案件はありません
                    </td>
                  </tr>
                ) : (
                  draftDeals.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">{d.salon_name}</td>
                      <td className="px-3 py-2">{d.machine_type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(Number(d.net_profit))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(d.appo_incentive)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(d.closer_incentive)}</td>
                      <td className="px-3 py-2">
                        {statusLabel(d.submit_status)}
                        {d.submit_status === "rejected" && d.reject_reason ? (
                          <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                            理由: {d.reject_reason}
                          </span>
                        ) : null}
                      </td>
                      <td className="space-x-2 whitespace-nowrap px-3 py-2">
                        <button type="button" className="text-blue-600 underline" onClick={() => openEdit(d)}>
                          編集
                        </button>
                        {d.submit_status === "draft" || d.submit_status === "rejected" ? (
                          <button
                            type="button"
                            className="text-emerald-700 underline dark:text-emerald-400"
                            disabled={saving}
                            onClick={() => void submitDeal(d.id)}
                          >
                            提出
                          </button>
                        ) : null}
                        {d.submit_status === "draft" ? (
                          <button
                            type="button"
                            className="text-red-600 underline"
                            onClick={() => void deleteDraft(d.id)}
                          >
                            削除
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium">
            {year}年{month}月の承認済みインセンティブ合計（あなたの分）: {formatYen(approvedMonthTotal)}
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {["サロン", "機種", "純利益", "自分の役割", "インセンティブ", "状態", "差戻し理由"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      履歴がありません
                    </td>
                  </tr>
                ) : (
                  historyDeals.map((d) => {
                    const roles: string[] = [];
                    let amt = 0;
                    if (d.appo_employee_id === props.userId) {
                      roles.push("アポ");
                      amt += d.appo_incentive;
                    }
                    if (d.closer_employee_id === props.userId) {
                      roles.push("クローザー");
                      amt += d.closer_incentive;
                    }
                    return (
                      <tr key={d.id} className="border-t border-zinc-100 dark:border-zinc-800/80">
                        <td className="px-3 py-2">{d.salon_name}</td>
                        <td className="px-3 py-2">{d.machine_type}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatYen(Number(d.net_profit))}</td>
                        <td className="px-3 py-2">{roles.join("・") || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatYen(amt)}</td>
                        <td className="px-3 py-2">{statusLabel(d.submit_status)}</td>
                        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {d.reject_reason ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">{editingId ? "案件を編集" : "新規案件"}</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-500">自分の役割（複数可）</span>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_appo}
                      onChange={(e) => setForm((f) => ({ ...f, is_appo: e.target.checked }))}
                    />
                    アポ
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_closer}
                      onChange={(e) => setForm((f) => ({ ...f, is_closer: e.target.checked }))}
                    />
                    クローザー
                  </label>
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">サロン名</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.salon_name}
                  onChange={(e) => setForm((f) => ({ ...f, salon_name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">機械種別</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.machine_type}
                  onChange={(e) => setForm((f) => ({ ...f, machine_type: e.target.value }))}
                >
                  {DEAL_MACHINE_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-zinc-500">販売価格（税込）</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">実質原価</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-zinc-500">支払い方法</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">レナード入金日</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">備考</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              {preview ? (
                <div className="rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900/80">
                  <p className="font-medium">プレビュー</p>
                  <p>純利益: {formatYen(preview.net_profit)}</p>
                  <p>
                    アポ {formatYen(preview.appo_incentive)} / クローザー {formatYen(preview.closer_incentive)}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border px-3 py-1.5 text-sm">
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                下書き保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
