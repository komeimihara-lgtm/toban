"use client";

import {
  DEAL_MACHINE_TYPES,
  buildDealComputed,
  normalizeDealServices,
  ratesFromDbRows,
  sumDealServiceCosts,
} from "@/lib/deals-compute";
import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string | null };

type DealRow = {
  id: string;
  year: number;
  month: number;
  salon_name: string;
  machine_type: string;
  cost_price: number;
  sale_price: number;
  net_profit: number;
  appo_incentive: number;
  closer_incentive: number;
  payment_status: string;
  submit_status: string;
  reject_reason: string | null;
  payment_date: string | null;
  payment_method: string;
  appo_employee_id: string | null;
  closer_employee_id: string | null;
  appo_employee_name?: string | null;
  closer_employee_name?: string | null;
  notes: string | null;
  deal_services?: { name: string; cost: number }[] | null;
};

type RateRow = { id: string; machine_type: string; role: string; rate: number };

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

type ServiceLineDraft = { name: string; cost: string };

const PAYMENT_STATUSES = [
  { value: "pending", label: "入金待ち" },
  { value: "partial", label: "一部入金" },
  { value: "paid", label: "全額入金" },
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
  payment_status: string;
  submit_status: string;
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
  payment_status: "pending",
  submit_status: "draft",
  notes: "",
});

export function DealsAdminClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"deals" | "staff" | "rates">("deals");

  const [pendingOnly, setPendingOnly] = useState(false);
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
  const [serviceLines, setServiceLines] = useState<ServiceLineDraft[]>([]);

  const [submission, setSubmission] = useState<{ submitted_at: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [rejectOpen, setRejectOpen] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    const q = pendingOnly ? `pending_only=1` : "";
    const res = await fetch(`/api/deals?year=${year}&month=${month}&${q}`);
    const j = (await res.json()) as { deals?: DealRow[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? "案件取得失敗");
    setDeals(j.deals ?? []);
    setSelected(new Set());
  }, [year, month, pendingOnly]);

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

  const serviceCostTotalLive = useMemo(
    () =>
      sumDealServiceCosts(
        normalizeDealServices(
          serviceLines.map((l) => ({ name: l.name, cost: Number(l.cost) })),
        ),
      ),
    [serviceLines],
  );

  const previewComputed = useMemo(() => {
    const sp = Number(form.sale_price);
    const cp = Number(form.cost_price);
    if (!Number.isFinite(sp) || !Number.isFinite(cp)) return null;
    const rows = rateRows.filter((r) => r.machine_type === form.machine_type);
    const mRates = ratesFromDbRows(
      rows.map((r) => ({ role: r.role, rate: rateDraft[`${r.machine_type}|${r.role}`] ?? r.rate })),
    );
    return buildDealComputed(
      sp,
      cp,
      mRates,
      {
        appoEmployeeId: form.appo_employee_id || null,
        closerEmployeeId: form.closer_employee_id || null,
      },
      serviceCostTotalLive,
    );
  }, [form, rateRows, rateDraft, serviceCostTotalLive]);

  const staffAggregate = useMemo(() => {
    const byId: Record<
      string,
      { name: string; appo: number; closer: number; appo_n: number; closer_n: number }
    > = {};

    const bump = (id: string | null, name: string | null | undefined, key: "appo" | "closer", v: number) => {
      if (!id) return;
      if (!byId[id]) byId[id] = { name: name ?? "（不明）", appo: 0, closer: 0, appo_n: 0, closer_n: 0 };
      byId[id][key] += v;
      if (key === "appo") byId[id].appo_n += 1;
      else byId[id].closer_n += 1;
      if (name) byId[id].name = name;
    };

    for (const d of deals) {
      bump(d.appo_employee_id, d.appo_employee_name, "appo", d.appo_incentive);
      bump(d.closer_employee_id, d.closer_employee_name, "closer", d.closer_incentive);
    }

    return Object.entries(byId).map(([employee_id, v]) => ({
      employee_id,
      ...v,
      total: v.appo + v.closer,
    }));
  }, [deals]);

  const downloadStaffCsv = () => {
    const header = ["氏名", "アポ件数", "アポ合計", "クローザー件数", "クローザー合計", "合計インセンティブ"];
    const lines = staffAggregate.map((s) =>
      [s.name, String(s.appo_n), String(s.appo), String(s.closer_n), String(s.closer), String(s.total)].join(","),
    );
    const sumAppo = staffAggregate.reduce((a, s) => a + s.appo, 0);
    const sumCloser = staffAggregate.reduce((a, s) => a + s.closer, 0);
    const sumTotal = staffAggregate.reduce((a, s) => a + s.total, 0);
    const sumAppoN = staffAggregate.reduce((a, s) => a + s.appo_n, 0);
    const sumCloserN = staffAggregate.reduce((a, s) => a + s.closer_n, 0);
    const body = [
      header.join(","),
      ...lines,
      `合計,${sumAppoN},${sumAppo},${sumCloserN},${sumCloser},${sumTotal}`,
    ].join("\r\n");
    const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `incentive_staff_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPayload());
    setServiceLines([]);
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
      payment_status: d.payment_status,
      submit_status: d.submit_status,
      notes: d.notes ?? "",
    });
    const ds = Array.isArray(d.deal_services) ? d.deal_services : [];
    setServiceLines(
      ds.length ? ds.map((row) => ({ name: row.name ?? "", cost: String(row.cost ?? "") })) : [],
    );
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
        payment_status: form.payment_status,
        submit_status: form.submit_status,
        notes: form.notes || null,
        deal_services: normalizeDealServices(
          serviceLines.map((l) => ({ name: l.name, cost: Number(l.cost) })),
        ),
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

  const approveOne = async (id: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/deals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "承認に失敗しました");
      await loadDeals();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectOpen) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setMsg("差戻し理由を入力してください");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/deals/${rejectOpen.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "差戻しに失敗しました");
      setRejectOpen(null);
      setRejectReason("");
      await loadDeals();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const bulkApprove = async () => {
    const ids = [...selected].filter(Boolean);
    if (ids.length === 0) {
      setMsg("案件を選択してください");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/deals/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "approve" }),
      });
      const j = (await res.json()) as { error?: string; approved_count?: number };
      if (!res.ok) throw new Error(j.error ?? "一括承認に失敗しました");
      setMsg(`承認しました（${j.approved_count ?? 0}件）`);
      await loadDeals();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
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
      setMsg("レートを保存しました。");
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
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "提出に失敗しました");
      await loadSubmission();
      setMsg(`${year}年${month}月の集計を提出しました。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提出エラー");
    } finally {
      setSaving(false);
    }
  };

  const freeeSync = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/deals/freee-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "連携キューへの登録に失敗しました");
      setMsg("freee 連携キューに登録しました（バッチ処理）。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = (s: string) => {
    if (s === "draft") return "下書き";
    if (s === "submitted") return "承認待ち";
    if (s === "approved") return "承認済";
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

      <div className="flex flex-wrap items-end gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
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
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          再読込
        </button>
        {tab === "deals" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            承認待ちのみ表示
          </label>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["deals", "案件一覧"],
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
      ) : tab === "deals" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              管理者による案件追加
            </button>
            <button
              type="button"
              disabled={saving || selected.size === 0}
              onClick={() => void bulkApprove()}
              className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-800 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-300"
            >
              選択を一括承認
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-2 py-2" />
                  {[
                    "サロン",
                    "機種",
                    "純利益",
                    "アポ",
                    "クローザー",
                    "アポ¥",
                    "クローザー¥",
                    "承認",
                    "入金",
                    "",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                      案件がありません
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => (
                    <tr key={d.id}>
                      <td className="px-2 py-2">
                        {d.submit_status === "submitted" ? (
                          <input
                            type="checkbox"
                            checked={selected.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                          />
                        ) : null}
                      </td>
                      <td className="px-2 py-2">{d.salon_name}</td>
                      <td className="px-2 py-2">{d.machine_type}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(Number(d.net_profit))}</td>
                      <td className="px-2 py-2">{d.appo_employee_name ?? "—"}</td>
                      <td className="px-2 py-2">{d.closer_employee_name ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(d.appo_incentive)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatYen(d.closer_incentive)}</td>
                      <td className="px-2 py-2">{submitLabel(d.submit_status)}</td>
                      <td className="px-2 py-2 text-xs">{d.payment_status === "paid" ? "全額" : "未/一部"}</td>
                      <td className="space-x-2 whitespace-nowrap px-2 py-2">
                        <button type="button" className="text-blue-600 underline" onClick={() => openEdit(d)}>
                          編集
                        </button>
                        {d.submit_status === "submitted" ? (
                          <>
                            <button
                              type="button"
                              className="text-emerald-700 underline dark:text-emerald-400"
                              onClick={() => void approveOne(d.id)}
                            >
                              承認
                            </button>
                            <button
                              type="button"
                              className="text-amber-700 underline dark:text-amber-400"
                              onClick={() => {
                                setRejectOpen({ id: d.id });
                                setRejectReason("");
                              }}
                            >
                              差戻し
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="text-red-600 underline" onClick={() => void deleteDeal(d.id)}>
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
              集計提出済: {new Date(submission.submitted_at).toLocaleString("ja-JP")}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={staffAggregate.length === 0}
              onClick={downloadStaffCsv}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 disabled:opacity-50"
            >
              CSVエクスポート
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {["スタッフ", "アポ件数", "アポ合計", "クローザー件数", "クローザー合計", "合計"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffAggregate.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                      表示中の案件から集計できません（案件一覧を確認）
                    </td>
                  </tr>
                ) : (
                  <>
                    {staffAggregate.map((s) => (
                      <tr key={s.employee_id} className="border-t border-zinc-100 dark:border-zinc-800/80">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.appo_n}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatYen(s.appo)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.closer_n}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatYen(s.closer)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{formatYen(s.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-zinc-300 font-medium dark:border-zinc-600">
                      <td className="px-3 py-2">合計</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {staffAggregate.reduce((a, s) => a + s.appo_n, 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatYen(staffAggregate.reduce((a, s) => a + s.appo, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {staffAggregate.reduce((a, s) => a + s.closer_n, 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatYen(staffAggregate.reduce((a, s) => a + s.closer, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatYen(staffAggregate.reduce((a, s) => a + s.total, 0))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitMonth()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              集計を提出記録
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void freeeSync()}
              className="rounded-md border border-zinc-400 px-4 py-2 text-sm dark:border-zinc-600"
            >
              freee 連携（キュー登録）
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            スタッフ別集計は現在表示中の案件一覧のデータを使います。全件で集計する場合は「承認待ちのみ」のチェックを外してください。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            機械種別ごとのアポ・クローザーの率（0〜1）。例: 4% = 0.04
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-3 py-2 text-left">機械種別</th>
                  <th className="px-3 py-2 text-left">役割</th>
                  <th className="px-3 py-2 text-left">率</th>
                </tr>
              </thead>
              <tbody>
                {rateRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.machine_type}</td>
                      <td className="px-3 py-2">{r.role === "appo" ? "アポ" : "クローザー"}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.0001"
                          className="w-32 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
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
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            レートを保存
          </button>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">{editingId ? "案件を編集" : "案件を追加"}</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-500">サロン名</span>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.salon_name}
                  onChange={(e) => setForm((f) => ({ ...f, salon_name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">機械種別</span>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                    className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">販売価格（税込）</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </label>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    サービス項目（原価加算）
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                    onClick={() => setServiceLines((rows) => [...rows, { name: "", cost: "" }])}
                  >
                    サービス項目を追加
                  </button>
                </div>
                {serviceLines.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">必要な場合のみ行を追加してください。</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {serviceLines.map((line, idx) => (
                      <li key={idx} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <label className="block">
                          <span className="text-xs text-zinc-500">サービス内容</span>
                          <input
                            className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                            placeholder="例：ハンドピース1本"
                            value={line.name}
                            onChange={(e) =>
                              setServiceLines((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                              )
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-zinc-500">サービス原価</span>
                          <input
                            type="number"
                            className="mt-1 w-full min-w-[8rem] rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                            value={line.cost}
                            onChange={(e) =>
                              setServiceLines((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, cost: e.target.value } : r)),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-red-600 underline sm:pb-2"
                          onClick={() => setServiceLines((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-zinc-500">支払い方法</span>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">レナード入金日</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">入金・進捗</span>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                <span className="text-xs text-zinc-500">承認フロー状態</span>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={form.submit_status}
                  onChange={(e) => setForm((f) => ({ ...f, submit_status: e.target.value }))}
                >
                  {["draft", "submitted", "approved", "rejected"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">アポ担当</span>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
                <span className="text-xs text-zinc-500">メモ</span>
                <textarea
                  className="mt-1 w-full rounded-md border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              {previewComputed ? (
                <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-900/60">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">販売価格（税抜）</span>
                    <span>{formatYen(Math.round(Number(form.sale_price) / 1.1))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">実質原価</span>
                    <span>−{formatYen(Number(form.cost_price))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">サービス原価合計</span>
                    <span>−{formatYen(serviceCostTotalLive)}</span>
                  </div>
                  <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
                  <div className="flex justify-between gap-4 font-medium">
                    <span>純利益</span>
                    <span>{formatYen(previewComputed.net_profit)}</span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-zinc-500">インセンティブ</p>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">アポ担当</span>
                    <span>{formatYen(previewComputed.appo_incentive)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">クローザー</span>
                    <span>{formatYen(previewComputed.closer_incentive)}</span>
                  </div>
                  <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
                  <div className="flex justify-between gap-4 font-medium">
                    <span>合計</span>
                    <span>
                      {formatYen(
                        previewComputed.appo_incentive + previewComputed.closer_incentive,
                      )}
                    </span>
                  </div>
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
                onClick={() => void saveDeal()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="font-semibold">差戻し理由</h3>
            <textarea
              className="mt-3 w-full rounded-md border px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="必須"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectOpen(null);
                  setRejectReason("");
                }}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmReject()}
                className="rounded-md bg-amber-800 px-3 py-1.5 text-sm text-white"
              >
                差戻しする
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
