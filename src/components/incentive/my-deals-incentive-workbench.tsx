"use client";

import { buildDealComputed, ratesFromDbRows, sumDealServiceCosts } from "@/lib/deals-compute";
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
  deal_services?: { name: string; cost: number }[] | null;
};

type RateRow = { machine_type: string; role: string; rate: number };
type ProductRowApi = { id: string; name: string; cost_price: number };

type ServiceLineDraft = { name: string; cost: string };

function serviceLinesToSaved(lines: ServiceLineDraft[]): { name: string; cost: number }[] {
  return lines
    .map((l) => ({
      name: l.name.trim(),
      cost: Number(l.cost),
    }))
    .filter((l) => l.name.length > 0 || (Number.isFinite(l.cost) && l.cost !== 0));
}

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

export function MyDealsIncentiveWorkbench(props: {
  userId: string;
  userName: string | null;
  /** false のときフォームからの即時提出を出さない（管理者は API 制約のため） */
  showSubmitFromForm?: boolean;
}) {
  const showSubmitFromForm = props.showSubmitFromForm !== false;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"input" | "performance" | "archive">("input");

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [rateRows, setRateRows] = useState<RateRow[]>([]);
  const [products, setProducts] = useState<ProductRowApi[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    salon_name: "",
    machine_type: "その他",
    cost_price: "",
    sale_price: "",
    payment_method: "",
    payment_date: "",
    notes: "",
    is_appo: true,
    is_closer: false,
  });
  const [serviceLines, setServiceLines] = useState<ServiceLineDraft[]>([]);

  type ArchiveRow = {
    year: number;
    month: number;
    approved_total: number;
    pending_total: number;
    submitted_count: number;
  };
  const [archiveMonths, setArchiveMonths] = useState<ArchiveRow[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

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

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    const j = (await res.json()) as { products?: ProductRowApi[]; error?: string };
    if (!res.ok) return;
    setProducts(
      (j.products ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        cost_price: Number(p.cost_price),
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
    void loadProducts();
  }, [loadRates, loadProducts]);

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

  useEffect(() => {
    if (tab !== "archive") return;
    void (async () => {
      setArchiveLoading(true);
      try {
        const r = await fetch("/api/me/deal-incentive-archive?months=12");
        const j = (await r.json()) as { months?: ArchiveRow[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? "集計の取得に失敗しました");
        setArchiveMonths(j.months ?? []);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "履歴集計エラー");
        setArchiveMonths([]);
      } finally {
        setArchiveLoading(false);
      }
    })();
  }, [tab]);

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

  const pendingMonthTotal = useMemo(
    () =>
      deals
        .filter((d) => d.submit_status === "submitted")
        .reduce((sum, d) => {
          let s = 0;
          if (d.appo_employee_id === props.userId) s += d.appo_incentive;
          if (d.closer_employee_id === props.userId) s += d.closer_incentive;
          return sum + s;
        }, 0),
    [deals, props.userId],
  );

  const serviceCostTotalLive = useMemo(
    () => sumDealServiceCosts(serviceLinesToSaved(serviceLines)),
    [serviceLines],
  );

  const rateInfo = useMemo(() => {
    const rows = rateRows.filter((r) => r.machine_type === form.machine_type);
    return ratesFromDbRows(rows);
  }, [rateRows, form.machine_type]);

  const preview = useMemo(() => {
    const sp = Number(form.sale_price);
    const cp = Number(form.cost_price);
    if (!Number.isFinite(sp) || !Number.isFinite(cp)) return null;
    return buildDealComputed(
      sp,
      cp,
      rateInfo,
      {
        appoEmployeeId: form.is_appo ? props.userId : null,
        closerEmployeeId: form.is_closer ? props.userId : null,
      },
      serviceCostTotalLive,
    );
  }, [form.sale_price, form.cost_price, form.is_appo, form.is_closer, rateInfo, props.userId, serviceCostTotalLive]);

  const applyProductById = (productId: string) => {
    setSelectedProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      machine_type: p.name,
      cost_price: String(p.cost_price),
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    const first = products[0];
    setSelectedProductId(first?.id ?? "");
    setForm({
      salon_name: "",
      machine_type: first?.name ?? "その他",
      cost_price: first != null ? String(first.cost_price) : "",
      sale_price: "",
      payment_method: "",
      payment_date: "",
      notes: "",
      is_appo: true,
      is_closer: false,
    });
    setServiceLines([]);
    setModalOpen(true);
  };

  const openEdit = (d: DealRow) => {
    if (d.submit_status !== "draft" && d.submit_status !== "rejected") return;
    setEditingId(d.id);
    const match = products.find((p) => p.name === d.machine_type);
    setSelectedProductId(match?.id ?? "");
    setForm({
      salon_name: d.salon_name,
      machine_type: d.machine_type,
      cost_price: String(d.cost_price),
      sale_price: String(d.sale_price),
      payment_method: d.payment_method,
      payment_date: d.payment_date ? d.payment_date.slice(0, 10) : "",
      notes: d.notes ?? "",
      is_appo: d.appo_employee_id === props.userId,
      is_closer: d.closer_employee_id === props.userId,
    });
    const ds = Array.isArray(d.deal_services) ? d.deal_services : [];
    setServiceLines(
      ds.length
        ? ds.map((row) => ({ name: row.name ?? "", cost: String(row.cost ?? "") }))
        : [],
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const saveDraft = async (alsoSubmit: boolean) => {
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
        deal_services: serviceLinesToSaved(serviceLines),
      };
      const url = editingId ? `/api/deals/${editingId}` : "/api/deals";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { error?: string; deal?: { id: string } };
      if (!res.ok) throw new Error(j.error ?? "保存に失敗しました");
      const dealId = j.deal?.id ?? editingId;
      if (alsoSubmit) {
        if (!dealId) throw new Error("案件IDが取得できませんでした");
        const res2 = await fetch(`/api/deals/${dealId}/submit`, { method: "POST" });
        const j2 = (await res2.json()) as { error?: string };
        if (!res2.ok) throw new Error(j2.error ?? "提出に失敗しました");
        setMsg("提出しました。承認をお待ちください。");
      }
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

  const statusBadgeClass = (s: string) => {
    if (s === "submitted")
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    if (s === "approved")
      return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
    if (s === "rejected")
      return "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";
    return "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-card";
  };

  return (
    <div className="space-y-6">
      {msg ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-card">
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <label className="block text-xs text-zinc-500">年</label>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">月</label>
          <select
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
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

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">月ショートカット（当月＋過去3ヶ月）</span>
        {[0, 1, 2, 3].map((i) => {
          const t = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const yy = t.getFullYear();
          const mm = t.getMonth() + 1;
          const label = i === 0 ? "当月" : `${i}ヶ月前`;
          const active = year === yy && month === mm;
          return (
            <button
              key={`${yy}-${mm}`}
              type="button"
              onClick={() => {
                setYear(yy);
                setMonth(mm);
              }}
              className={
                active
                  ? "rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-card dark:text-zinc-200"
              }
            >
              {label}（{yy}/{pad2(mm)}）
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["input", "案件入力"],
            ["performance", "マイ実績"],
            ["archive", "履歴（12ヶ月）"],
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

      {loading && tab !== "archive" ? (
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
              <thead className="bg-zinc-50 dark:bg-card">
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
      ) : tab === "performance" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <p className="font-medium">
              {year}年{month}月 — 確定（承認済）:{" "}
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatYen(approvedMonthTotal)}
              </span>
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              承認待ち（試算）:{" "}
              <span className="tabular-nums font-medium text-amber-800 dark:text-amber-200">
                {formatYen(pendingMonthTotal)}
              </span>
            </p>
          </div>
          {historyDeals.length === 0 ? (
            <p className="text-sm text-zinc-500">この月の提出済み案件はありません</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {historyDeals.map((d) => {
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
                  <div
                    key={d.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-card/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{d.salon_name}</p>
                        <p className="text-xs text-zinc-500">{d.machine_type}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(d.submit_status)}`}
                      >
                        {statusLabel(d.submit_status)}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-zinc-500">純利益</dt>
                        <dd className="tabular-nums">{formatYen(Number(d.net_profit))}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-zinc-500">あなたの役割</dt>
                        <dd>{roles.join("・") || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2 font-medium">
                        <dt className="text-zinc-600">インセンティブ</dt>
                        <dd className="tabular-nums">{formatYen(amt)}</dd>
                      </div>
                    </dl>
                    {d.submit_status === "rejected" && d.reject_reason ? (
                      <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                        差戻し: {d.reject_reason}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.submit_status === "rejected" ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-blue-600 underline dark:text-blue-400"
                          onClick={() => openEdit(d)}
                        >
                          修正して再提出
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            過去12ヶ月の月別集計です。行を参考に、上の「月ショートカット」または年月で該当月を開いてください。
          </p>
          {archiveLoading ? (
            <p className="text-sm text-zinc-500">集計を読み込み中…</p>
          ) : archiveMonths.length === 0 ? (
            <p className="text-sm text-zinc-500">データがありません</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-card">
                  <tr>
                    {["年月", "承認済インセン（自分）", "承認待ち（試算）", "承認待ち件数", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {archiveMonths.map((row) => (
                    <tr key={`${row.year}-${row.month}`} className="border-t border-zinc-100 dark:border-zinc-800/80">
                      <td className="px-3 py-2 tabular-nums">
                        {row.year}年{pad2(row.month)}月
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(row.approved_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatYen(row.pending_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.submitted_count}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-blue-600 underline dark:text-blue-400"
                          onClick={() => {
                            setYear(row.year);
                            setMonth(row.month);
                            setTab("performance");
                          }}
                        >
                          詳細を見る
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-card">
            <h3 className="text-lg font-semibold">{editingId ? "案件を編集" : "新規案件"}</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-500">商品マスタ</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                  value={selectedProductId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) applyProductById(v);
                    else setSelectedProductId("");
                  }}
                >
                  <option value="">選択してください（その他は手で原価入力）</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}（標準原価 {p.cost_price.toLocaleString("ja-JP")} 円）
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  インセンティブ率は「{form.machine_type}」に紐づくマスタを参照します。
                </p>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">自分の役割（複数可・インセン試算）</span>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
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
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                  value={form.salon_name}
                  onChange={(e) => setForm((f) => ({ ...f, salon_name: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-zinc-500">販売価格（税込）</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">実質原価（商品選択で自動・編集可）</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </label>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">サービス項目（原価加算）</span>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                    onClick={() => setServiceLines((rows) => [...rows, { name: "", cost: "" }])}
                  >
                    サービス項目を追加
                  </button>
                </div>
                {serviceLines.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">必要な場合のみ「追加」で行を増やしてください。</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {serviceLines.map((line, idx) => (
                      <li key={idx} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <label className="block sm:col-span-1">
                          <span className="text-xs text-zinc-500">サービス内容</span>
                          <input
                            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
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
                            className="mt-1 w-full min-w-[8rem] rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                            placeholder="0"
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
              {preview ? (
                <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm tabular-nums dark:border-zinc-600 dark:bg-card">
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
                    <span>{formatYen(preview.net_profit)}</span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-zinc-500">あなたのインセンティブ</p>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      アポ（率{(rateInfo.appo * 100).toFixed(1)}%）
                    </span>
                    <span>{formatYen(preview.appo_incentive)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      クローザー（率{(rateInfo.closer * 100).toFixed(1)}%）
                    </span>
                    <span>{formatYen(preview.closer_incentive)}</span>
                  </div>
                  <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
                  <div className="flex justify-between gap-4 font-medium">
                    <span>合計</span>
                    <span>{formatYen(preview.appo_incentive + preview.closer_incentive)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">販売価格・実質原価を入力すると試算を表示します。</p>
              )}
              <label className="block">
                <span className="text-xs text-zinc-500">支払い方法</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">レナード入金日</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">備考</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-card"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border px-3 py-1.5 text-sm">
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                下書き保存
              </button>
              {showSubmitFromForm ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDraft(true)}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  提出する
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
