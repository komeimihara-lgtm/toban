"use client";

import {
  saveAutoApprovalRulesAction,
  type AutoRulePatch,
} from "@/app/actions/auto-approval-rules-actions";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type AutoRuleRow = {
  id: string;
  category: string;
  max_amount: number | null;
  per_person: boolean;
  is_enabled: boolean;
};

export function AutoApprovalRulesForm({
  initialRules,
}: {
  initialRules: AutoRuleRow[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sorted = useMemo(
    () => [...rules].sort((a, b) => a.category.localeCompare(b.category, "ja")),
    [rules],
  );

  function patch<T extends keyof AutoRuleRow>(
    id: string,
    key: T,
    value: AutoRuleRow[T],
  ) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  }

  function save() {
    setMsg(null);
    setErr(null);
    const patches: AutoRulePatch[] = sorted.map((r) => ({
      id: r.id,
      max_amount: Math.max(0, Number(r.max_amount ?? 0)),
      per_person: r.per_person,
      is_enabled: r.is_enabled,
    }));
    start(async () => {
      const res = await saveAutoApprovalRulesAction(patches);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("保存しました。");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
        各カテゴリについて、<strong>上限金額以下</strong>かつ
        <strong> AI審査スコアが80点以上</strong>
        の経費は、申請直後に自動的に承認されます（有効なルールのみ）。接待交際費など「1人あたり計算」では、金額を参加人数で割った値で上限と比較します。
      </p>

      {err && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      )}
      {msg && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">カテゴリ</th>
              <th className="px-4 py-3">上限（円）</th>
              <th className="px-4 py-3">1人あたり</th>
              <th className="px-4 py-3">自動承認</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((r) => (
              <tr key={r.id} className="bg-white dark:bg-zinc-950">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {r.category}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={!r.is_enabled}
                    value={r.max_amount ?? ""}
                    onChange={(e) =>
                      patch(r.id, "max_amount", Number(e.target.value) || 0)
                    }
                    className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 tabular-nums disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.per_person}
                      onChange={(e) =>
                        patch(r.id, "per_person", e.target.checked)
                      }
                      className="rounded border-zinc-400"
                    />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      人数で割る
                    </span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.is_enabled}
                      onChange={(e) =>
                        patch(r.id, "is_enabled", e.target.checked)
                      }
                      className="rounded border-zinc-400"
                    />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      有効
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? "保存中…" : "変更を保存"}
      </button>
    </div>
  );
}
