"use client";

import { DEAL_MACHINE_TYPES, buildDealComputed, ratesFromDbRows } from "@/lib/deals-compute";
import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string | null;
};

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
  appo_employee_id: string | null;
  closer_employee_id: string | null;
  hito_employee_id: string | null;
  hito_bottles: number | null;
  appo_incentive: number;
  closer_incentive: number;
  hito_incentive: number;
  payment_status: string;
  notes: string | null;
  appo_employee_name?: string | null;
  closer_employee_name?: string | null;
  hito_employee_name?: string | null;
};

type RateRow = {
  id: string;
  machine_type: string;
  role: string;
  rate: number;
};

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

const PAYMENT_STATUSES = [
  { value: "pending", label: "入金待ち" },
  { value: "partial", label: "一部入金" },
  { value: "paid", label: "全額入金（確定）" },
] as const;

type EditPayload = {
  salon_name: string;
  machine_type: string;
  cost_price: string;
  sale_price: string;
  payment_method: string;
  payment_date: string;
  appo_employee_id: string;
  closer_employee_id: string;
  hito_employee_id: string;
  hito_bottles: string;
  payment_status: string;
  notes: string;
};

const emptyPayload = (): EditPayload => ({
  salon_name: "",
  machine_type: DEAL_MACHINE_TYPES[0],
  cost_price: "",
  sale_price: "",
  payment_method: "",
  payment_date: "",
  appo_employee_id: "",
  closer_employee_id: "",
  hito_employee_id: "",
  hito_bottles: "",
  payment_status: "pending",
  notes: "",
});

export function DealsAdminClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"deals" | "staff" | "rates">("deals");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [rateRows, setRateRows] = useState<RateRow[]>([]);
  const [rateDraft, setRateDraft] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditPayload>(emptyPayload());

  const [submission, setSubmission] = useState<{ submitted_at: string } | null>(null);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/settings/employees");
    const j = (await res.json()) as { employees?: { id: string; name: string | null }[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? "従業員取得失敗");
    setEmployees(
      (j.employees ?? []).map((e) => ({
        id: e.id,
        name: e.name,
      })),
    );
  }, []);

  const loadDeals = useCallback(async () => {
    const res = await fetch(`/api/deals?year=${year}&month=${month}`);
    const j = (await res.json()) as { deals?: DealRow[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? "案件取得失敗");
    setDeals(j.deals ?? []);
  }, [year, month]);

  const loadRates = useCallback(async () => {
    const res = await fetch("/api/deal-incentive-rates");
    const j = (await res.json()) as { rates?: RateRow[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? "レート取得失敗");
    const rows = j.rates ?? [];
    setRateRows(rows);
    const draft: Record<string, number> = {};
    for (const r of rows) {
      draft[`${r.machine_type}|${r.role}`] = Number(r.rate);
    }
    setRateDraft(draft);
  }, []);

  const loadSubmission = useCallback(async () => {
    const res = await fetch(`/api/deals/submit-month?year=${year}&month=${month}`);
    const j = (await res.json()) as { submission?: { submitted_at: string } | null; error?: string };
    if (!res.ok) throw new Error(j.error ?? "提出状態取得失敗");
    setSubmission(j.submission ?? null);
  }, [year, month]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      await Promise.all([loadEmployees(), loadDeals(), loadRates(), loadSubmission()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }, [loadDeals, loadEmployees, loadRates, loadSubmission]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMsg(null);
      try {
        await Promise.all([loadDeals(), loadRates(), loadSubmission()]);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "読み込みエラー");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDeals, loadRates, loadSubmission]);

  const previewComputed = useMemo(() => {
    const sp = Number(form.sale_price);
    const cp = Number(form.cost_price);
    if (!Number.isFinite(sp) || !Number.isFinite(cp)) {
      return null;
    }
    const rows = rateRows.filter((r) => r.machine_type === form.machine_type);
    const mRates = ratesFromDbRows(rows.map((r) => ({ role: r.role, rate: rateDraft[`${r.machine_type}|${r.role}`] ?? r.rate })));
    return buildDealComputed(sp, cp, mRates, {
      appoEmployeeId: form.appo_employee_id || null,
      closerEmployeeId: form.closer_employee_id || null,
      hitoEmployeeId: form.hito_employee_id || null,
      hitoBottles: form.hito_bottles ? Number(form.hito_bottles) : null,
    });
  }, [form, rateRows, rateDraft]);

  const staffAggregate = useMemo(() => {
    const byId: Record<
      string,
      { name: string; appo: number; closer: number; hito: number }
    > = {};

    const bump = (
      id: string | null,
      name: string | null | undefined,
      key: "appo" | "closer" | "hito",
      v: number,
    ) => {
      if (!id) return;
      if (!byId[id]) byId[id] = { name: name ?? "（不明）", appo: 0, closer: 0, hito: 0 };
      byId[id][key] += v;
      if (name) byId[id].name = name;
    };

    for (const d of deals) {
      bump(d.appo_employee_id, d.appo_employee_name, "appo", d.appo_incentive);
      bump(d.closer_employee_id, d.closer_employee_name, "closer", d.closer_incentive);
      bump(d.hito_employee_id, d.hito_employee_name, "hito", d.hito_incentive);
    }

    return Object.entries(byId).map(([employee_id, v]) => ({
      employee_id,
      ...v,
      total: v.appo + v.closer + v.hito,
    }));
  }, [deals]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPayload());
    setModalOpen(true);
  };

  const openEdit = (d: DealRow) => {
    setEditingId(d.id);
    setForm({
      salon_name: d.salon_name,
      machine_type: d.machine_type,
      cost_price: String(d.cost_price),
      sale_price: String(d.sale_price),
      payment_method: d.payment_method,
      payment_date: d.payment_date ? d.payment_date.slice(0, 10) : "",
      appo_employee_id: d.appo_employee_id ?? "",
      closer_employee_id: d.closer_employee_id ?? "",
      hito_employee_id: d.hito_employee_id ?? "",
      hito_bottles: d.hito_bottles != null ? String(d.hito_bottles) : "",
      payment_status: d.payment_status,
      notes: d.notes ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const saveDeal = async () => {
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
        appo_employee_id: form.appo_employee_id || null,
        closer_employee_id: form.closer_employee_id || null,
        hito_employee_id: form.hito_employee_id || null,
        hito_bottles: form.hito_bottles ? Number(form.hito_bottles) : null,
        payment_status: form.payment_status,
        notes: form.notes || null,
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
      await loadSubmission();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存エラー");
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (id: string) => {
    if (!confirm("この案件を削除しますか？")) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "削除に失敗しました");
      await loadDeals();
      await loadSubmission();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "削除エラー");
    } finally {
      setSaving(false);
    }
  };

  const saveRates = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const rates = rateRows.map((r) => ({
        machine_type: r.machine_type,
        role: r.role,
        rate: rateDraft[`${r.machine_type}|${r.role}`] ?? r.rate,
      }));
      const res = await fetch("/api/deal-incentive-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "レート保存に失敗しました");
      await loadRates();
      await loadDeals();
      setMsg("レートを保存しました。案件の再計算が必要な場合は各案件を開いて保存し直してください。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存エラー");
    } finally {
      setSaving(false);
    }
  };

  const submitMonth = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/deals/submit-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const j = (await res.json()) as { error?: string; summary?: unknown };
      if (!res.ok) throw new Error(j.error ?? "提出に失敗しました");
      await loadSubmission();
      setMsg(`${year}年${month}月の集計を提出しました。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提出エラー");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {msg ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">年</label>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">月</label>
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
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          再読込
        </button>
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["deals", "案件入力"],
            ["staff", "スタッフ別集計"],
            ["rates", "レート設定"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "border-b-2 border-zinc-900 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : tab === "deals" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              案件を追加
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {[
                    "サロン",
                    "機種",
                    "原価",
                    "販売（税込）",
                    "純利益",
                    "アポ",
                    "クローザー",
                    "ヒト幹",
                    "アポ¥",
                    "クローザー¥",
                    "ヒト幹¥",
                    "入金",
                    "進捗",
                    "",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-zinc-500">
                      この月の案件はまだありません
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30">
                      <td className="px-2 py-2">{d.salon_name}</td>
                      <td className="px-2 py-2">{d.machine_type}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(Number(d.cost_price))}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(Number(d.sale_price))}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(Number(d.net_profit))}</td>
                      <td className="px-2 py-2">{d.appo_employee_name ?? "—"}</td>
                      <td className="px-2 py-2">{d.closer_employee_name ?? "—"}</td>
                      <td className="px-2 py-2">{d.hito_employee_name ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(d.appo_incentive)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(d.closer_incentive)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(d.hito_incentive)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-zinc-600 dark:text-zinc-400">
                        {d.payment_date ? d.payment_date.slice(0, 10) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {d.payment_status === "paid" ? (
                          <span className="text-emerald-700 dark:text-emerald-400">確定</span>
                        ) : d.payment_status === "partial" ? (
                          <span className="text-amber-700 dark:text-amber-400">一部</span>
                        ) : (
                          <span className="text-zinc-500">入金待ち</span>
                        )}
                      </td>
                      <td className="space-x-2 whitespace-nowrap px-2 py-2">
                        <button type="button" className="text-blue-600 underline dark:text-blue-400" onClick={() => openEdit(d)}>
                          編集
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline dark:text-red-400"
                          onClick={() => void deleteDeal(d.id)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "staff" ? (
        <div className="space-y-6">
          {submission ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              提出済み: {new Date(submission.submitted_at).toLocaleString("ja-JP")}
            </p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">未提出です。内容を確認して提出してください。</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {["スタッフ", "アポ", "クローザー", "ヒト幹", "合計"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {staffAggregate.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                      集計対象がありません
                    </td>
                  </tr>
                ) : (
                  staffAggregate.map((s) => (
                    <tr key={s.employee_id}>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(s.appo)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(s.closer)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(s.hito)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatYen(s.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {staffAggregate.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-zinc-300 font-medium dark:border-zinc-600">
                    <td className="px-3 py-2">合計</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatYen(staffAggregate.reduce((a, s) => a + s.appo, 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatYen(staffAggregate.reduce((a, s) => a + s.closer, 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatYen(staffAggregate.reduce((a, s) => a + s.hito, 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatYen(staffAggregate.reduce((a, s) => a + s.total, 0))}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void submitMonth()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            合計を確認して提出する
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            機械種別ごとのアポ・クローザー・ヒト幹の率（0〜1、例: 4% = 0.04）を編集します。
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-3 py-2 text-left">機械種別</th>
                  <th className="px-3 py-2 text-left">役割</th>
                  <th className="px-3 py-2 text-left">率（小数）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {rateRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.machine_type}</td>
                    <td className="px-3 py-2">
                      {r.role === "appo" ? "アポ" : r.role === "closer" ? "クローザー" : "ヒト幹"}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                        value={rateDraft[`${r.machine_type}|${r.role}`] ?? r.rate}
                        onChange={(e) =>
                          setRateDraft((prev) => ({
                            ...prev,
                            [`${r.machine_type}|${r.role}`]: Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveRates()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            レートを保存
          </button>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{editingId ? "案件を編集" : "案件を追加"}</h3>
            <div className="mt-4 grid gap-3 text-sm">
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
                  <span className="text-xs text-zinc-500">実質原価</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">販売価格（税込）</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
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
                <span className="text-xs text-zinc-500">進捗</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.payment_status}
                  onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))}
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">アポ担当</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.appo_employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, appo_employee_id: e.target.value }))}
                >
                  <option value="">（なし）</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name ?? e.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">クローザー担当</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.closer_employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, closer_employee_id: e.target.value }))}
                >
                  <option value="">（なし）</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name ?? e.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">ヒト幹担当（任意）</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.hito_employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, hito_employee_id: e.target.value }))}
                >
                  <option value="">（なし）</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name ?? e.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">ヒト幹本数（任意・倍率）</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.hito_bottles}
                  onChange={(e) => setForm((f) => ({ ...f, hito_bottles: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">メモ</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              {previewComputed ? (
                <div className="rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900/80">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">プレビュー（保存時に同じ値が入ります）</p>
                  <p>純利益: {formatYen(previewComputed.net_profit)}</p>
                  <p>
                    アポ {formatYen(previewComputed.appo_incentive)} / クローザー{" "}
                    {formatYen(previewComputed.closer_incentive)} / ヒト幹 {formatYen(previewComputed.hito_incentive)}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDeal()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
