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

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function IncentiveRatesSettings() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
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

  const salesMembers = useMemo(
    () =>
      employees.filter(
        (e) => e.department_id === salesDeptId && e.is_sales_target,
      ),
    [employees, salesDeptId],
  );
  const serviceMembers = useMemo(
    () =>
      employees.filter(
        (e) => e.department_id === serviceDeptId && e.is_service_target,
      ),
    [employees, serviceDeptId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [dr, er] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/settings/employees"),
      ]);
      const dj = (await dr.json()) as { departments?: Dept[] };
      const ej = (await er.json()) as { employees?: Employee[] };
      if (!dr.ok) throw new Error((dj as { error?: string }).error);
      if (!er.ok) throw new Error((ej as { error?: string }).error);
      setDepts(dj.departments ?? []);
      setEmployees(ej.employees ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/settings/incentive-rates?year=${year}&month=${month}`,
      );
      const j = (await res.json()) as {
        rates?: { employee_id: string; rate: number }[];
        error?: string;
      };
      if (!res.ok) {
        setMsg(j.error ?? "率の取得に失敗");
        return;
      }
      const next: Record<string, string> = {};
      for (const r of j.rates ?? []) {
        next[r.employee_id] = String(r.rate);
      }
      setRates(next);
    })();
  }, [year, month]);

  async function save() {
    const list = [...salesMembers, ...serviceMembers].map((e) => ({
      employee_id: e.id,
      rate: Number(rates[e.id] ?? 0),
    }));
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/incentive-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, rates: list }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "保存失敗");
      setMsg("保存しました。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevMonth() {
    let py = year;
    let pm = month - 1;
    if (pm < 1) {
      pm = 12;
      py -= 1;
    }
    setMsg(null);
    try {
      const res = await fetch(
        `/api/settings/incentive-rates?year=${py}&month=${pm}`,
      );
      const j = (await res.json()) as {
        rates?: { employee_id: string; rate: number }[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "前月の取得に失敗");
      const next = { ...rates };
      for (const r of j.rates ?? []) {
        next[r.employee_id] = String(r.rate);
      }
      setRates(next);
      setMsg(`${py}年${pm}月の率を画面に反映しました。必要なら「率を保存」してください。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    }
  }

  function row(
    label: string,
    members: Employee[],
    hint: string,
  ) {
    return (
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h3 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          {label}
          <span className="ml-2 text-xs font-normal text-zinc-500">{hint}</span>
        </h3>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {members.length === 0 ? (
            <li className="px-4 py-4 text-sm text-zinc-500">対象者なし</li>
          ) : (
            members.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-[8rem] font-medium">{e.name ?? "—"}</span>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  率（%・パーセント数値）
                  <input
                    type="number"
                    step="0.01"
                    className="w-28 rounded border border-zinc-300 px-2 py-1 tabular-nums dark:border-zinc-600 dark:bg-zinc-900"
                    value={rates[e.id] ?? ""}
                    placeholder="0"
                    onChange={(ev) =>
                      setRates((prev) => ({
                        ...prev,
                        [e.id]: ev.target.value,
                      }))
                    }
                  />
                </label>
              </li>
            ))
          )}
        </ul>
      </section>
    );
  }

  if (loading) return <p className="text-sm text-zinc-500">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          年
          <input
            type="number"
            className="mt-1 block w-24 rounded border px-2 py-1.5 dark:bg-zinc-900"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="text-xs">
          月
          <input
            type="number"
            min={1}
            max={12}
            className="mt-1 block w-20 rounded border px-2 py-1.5 dark:bg-zinc-900"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => void copyPrevMonth()}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
        >
          前月の設定をコピー
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          率を保存
        </button>
      </div>

      {row("営業部", salesMembers, "川津・大岩・小笠原・飯田（DBフラグ準拠）")}
      {row("サービス部", serviceMembers, "高橋・田村・中村・橋本（DBフラグ準拠）")}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
        <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">
          承認フロー（経費・インセンティブ共通イメージ）
        </h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          申請者 → <strong>千葉</strong>（第1承認）→ <strong>三原孔明</strong>
          （最終承認）→ 完了
        </p>
      </section>

      {msg ? <p className="text-sm text-emerald-800 dark:text-emerald-200">{msg}</p> : null}

      <p className="text-xs text-zinc-500">
        対象月キー:{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          {ymLabel(year, month)}
        </code>
      </p>
    </div>
  );
}
