"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string | null;
  department_id: string | null;
  is_sales_target: boolean;
  is_service_target: boolean;
};

type Dept = { id: string; name: string };

type RateRow = { employee_id: string; rate: number };

function ym(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

/** 売上 × 率(パーセント) / 100 */
function incentiveAmount(sales: number, ratePercent: number) {
  return Math.floor((Number(sales) * Number(ratePercent)) / 100);
}

export function IncentiveDeptWorkbench() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"sales" | "service">("sales");
  const [depts, setDepts] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [salesInput, setSalesInput] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const salesDeptId = useMemo(
    () => depts.find((d) => d.name === "営業部")?.id ?? "",
    [depts],
  );
  const serviceDeptId = useMemo(
    () => depts.find((d) => d.name === "サービス部")?.id ?? "",
    [depts],
  );

  const activeDeptId = tab === "sales" ? salesDeptId : serviceDeptId;

  const members = useMemo(() => {
    if (!activeDeptId) return [];
    return employees.filter((e) => {
      if (e.department_id !== activeDeptId) return false;
      if (tab === "sales") return e.is_sales_target;
      return e.is_service_target;
    });
  }, [employees, activeDeptId, tab]);

  const memberIdsKey = useMemo(
    () =>
      members
        .map((x) => x.id)
        .sort()
        .join(","),
    [members],
  );

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [dr, er] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/settings/employees"),
      ]);
      const dj = (await dr.json()) as { departments?: Dept[] };
      const ej = (await er.json()) as {
        employees?: {
          id: string;
          name: string | null;
          department_id: string | null;
          is_sales_target: boolean;
          is_service_target: boolean;
        }[];
      };
      if (!dr.ok) throw new Error((dj as { error?: string }).error ?? "部門取得失敗");
      if (!er.ok) throw new Error((ej as { error?: string }).error ?? "従業員取得失敗");
      setDepts(dj.departments ?? []);
      setEmployees(
        (ej.employees ?? []).map((x) => ({
          id: x.id,
          name: x.name,
          department_id: x.department_id,
          is_sales_target: x.is_sales_target,
          is_service_target: x.is_service_target,
        })),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/settings/incentive-rates?year=${year}&month=${month}`,
      );
      const j = (await res.json()) as { rates?: RateRow[]; error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "率の取得に失敗");
        return;
      }
      const m: Record<string, number> = {};
      for (const r of j.rates ?? []) {
        m[r.employee_id] = Number(r.rate);
      }
      setRates(m);
    })();
  }, [year, month]);

  useEffect(() => {
    if (!activeDeptId || !memberIdsKey) return;
    void (async () => {
      const res = await fetch(
        `/api/incentives?year=${year}&month=${month}&department_id=${encodeURIComponent(activeDeptId)}`,
      );
      const j = (await res.json()) as {
        configs?: { employee_id: string; sales_amount: number }[];
      };
      if (!res.ok) return;
      const next: Record<string, string> = {};
      for (const c of j.configs ?? []) {
        const row = c as { employee_id: string; sales_amount: number };
        next[row.employee_id] =
          row.sales_amount != null ? String(row.sales_amount) : "";
      }
      const ids = memberIdsKey.split(",").filter(Boolean);
      setSalesInput((prev) => {
        const merged = { ...prev };
        for (const id of ids) {
          if (next[id] !== undefined && next[id] !== "") merged[id] = next[id];
        }
        return merged;
      });
    })();
  }, [year, month, activeDeptId, memberIdsKey, tab]);

  const totalIncentive = useMemo(() => {
    let t = 0;
    for (const m of members) {
      const s = Number(String(salesInput[m.id] ?? "").replace(/,/g, ""));
      const r = rates[m.id] ?? 0;
      if (Number.isFinite(s) && s >= 0) t += incentiveAmount(s, r);
    }
    return t;
  }, [members, salesInput, rates]);

  async function submit(status: "draft" | "submitted") {
    if (!activeDeptId) {
      setMsg("部門が取得できません");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const configs = members.map((m) => {
        const s = Number(String(salesInput[m.id] ?? "").replace(/,/g, ""));
        const rate = rates[m.id] ?? 0;
        const sales = Number.isFinite(s) && s >= 0 ? s : 0;
        return {
          year,
          month,
          department_id: activeDeptId,
          employee_id: m.id,
          employee_name: m.name,
          sales_amount: sales,
          rate,
          incentive_amount: incentiveAmount(sales, rate),
          formula_type: "fixed_rate",
          status,
        };
      });
      const res = await fetch("/api/incentives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "保存に失敗");
        return;
      }
      setMsg(status === "submitted" ? "提出しました。" : "下書き保存しました。");
    } catch {
      setMsg("通信エラー");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card">
        <label className="text-xs text-zinc-600 dark:text-zinc-400">
          年
          <input
            type="number"
            className="mt-1 block w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-zinc-600 dark:text-zinc-400">
          月
          <input
            type="number"
            min={1}
            max={12}
            className="mt-1 block w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-zinc-500">
          設定率: {ym(year, month)} の{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-card/80">incentive_rates</code>
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("sales")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            tab === "sales"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          営業部（川津・大岩・小笠原・飯田）
        </button>
        <button
          type="button"
          onClick={() => setTab("service")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            tab === "service"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          サービス部（高橋・田村・中村・橋本）
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-card">
            <tr>
              <th className="px-4 py-3">メンバー</th>
              <th className="px-4 py-3">月間売上（円）</th>
              <th className="px-4 py-3">率（%）</th>
              <th className="px-4 py-3">インセンティブ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  対象メンバーがいません（部門・フラグを確認してください）
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const raw = salesInput[m.id] ?? "";
                const s = Number(String(raw).replace(/,/g, ""));
                const r = rates[m.id] ?? 0;
                const inv =
                  Number.isFinite(s) && s >= 0 ? incentiveAmount(s, r) : 0;
                return (
                  <tr key={m.id} className="bg-white dark:bg-card/30">
                    <td className="px-4 py-3 font-medium">{m.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-36 rounded border border-zinc-300 px-2 py-1.5 tabular-nums dark:border-zinc-600 dark:bg-card"
                        value={raw}
                        placeholder="0"
                        onChange={(e) =>
                          setSalesInput((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {r ? `${r}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {formatYen(inv)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          合計（表示中タブ）: {formatYen(totalIncentive)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !activeDeptId}
            onClick={() => void submit("draft")}
            className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-900 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-100"
          >
            下書き保存
          </button>
          <button
            type="button"
            disabled={saving || !activeDeptId}
            onClick={() => void submit("submitted")}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:hover:bg-emerald-600"
          >
            提出
          </button>
        </div>
      </div>

      {msg ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{msg}</p>
      ) : null}
    </div>
  );
}
