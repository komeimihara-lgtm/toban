"use client";

import { useState } from "react";

type Dept = { id: string; name: string; incentive_enabled: boolean };

export function DepartmentIncentiveToggle({ departments }: { departments: Dept[] }) {
  const [depts, setDepts] = useState(departments);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function toggle(id: string, current: boolean) {
    setSaving(id);
    setToast(null);
    try {
      const res = await fetch("/api/settings/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, incentive_enabled: !current }),
      });
      if (!res.ok) {
        const err = await res.json();
        setToast(err.error ?? "更新に失敗しました");
        return;
      }
      setDepts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, incentive_enabled: !current } : d))
      );
      setToast("保存しました");
    } catch {
      setToast("更新に失敗しました");
    } finally {
      setSaving(null);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div>
      <ul className="mt-2 space-y-2">
        {depts.map((d) => (
          <li key={d.id} className="flex items-center justify-between">
            <span className="text-sm">{d.name}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${d.incentive_enabled ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>
                {d.incentive_enabled ? "インセンティブ対象" : "対象外"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={d.incentive_enabled}
                disabled={saving === d.id}
                onClick={() => toggle(d.id, d.incentive_enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  d.incentive_enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                    d.incentive_enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {toast && (
        <p className={`mt-3 text-xs ${toast === "保存しました" ? "text-emerald-600" : "text-red-600"}`}>
          {toast}
        </p>
      )}
    </div>
  );
}
