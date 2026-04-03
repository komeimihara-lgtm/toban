"use client";

import { useEffect, useState } from "react";

type Dept = { id: string; name: string; incentive_enabled: boolean };

export function IncentiveConfigsCalculatePanel() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/departments");
      const j = (await res.json()) as { departments?: Dept[] };
      const list = (j.departments ?? []).filter((d) => d.incentive_enabled);
      setDepts(list);
      const sales = list.find((d) => d.name === "営業部");
      const svc = list.find((d) => d.name === "サービス部");
      setDeptId(sales?.id ?? svc?.id ?? list[0]?.id ?? "");
    })();
  }, []);

  async function run() {
    if (!deptId) {
      setMsg("部門を選択してください");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/incentives/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, department_id: deptId }),
      });
      const j = (await res.json()) as { error?: string; configs?: unknown[]; message?: string };
      if (!res.ok) {
        setMsg(j.error ?? "エラー");
        return;
      }
      setMsg(
        `${j.configs?.length ?? 0} 件を試算・保存しました。${j.message ? ` ${j.message}` : ""}`,
      );
    } catch {
      setMsg("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
      <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        月次インセンティブ試算（incentive_configs）
      </h2>
      <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
        営業部 / サービス部を切り替え、率（incentive_rates）と売上登録済み行から upsert します。
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          部門
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="mt-1 block rounded border border-emerald-200 bg-white px-2 py-1.5 text-sm dark:border-emerald-800 dark:bg-card"
          >
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          年
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-24 rounded border border-emerald-200 bg-white px-2 py-1.5 text-sm dark:border-emerald-800 dark:bg-card"
          />
        </label>
        <label className="text-xs">
          月
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 block w-20 rounded border border-emerald-200 bg-white px-2 py-1.5 text-sm dark:border-emerald-800 dark:bg-card"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          試算を実行
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-900 dark:text-emerald-200">{msg}</p>}
    </section>
  );
}
