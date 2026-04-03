"use client";

import type { Company, CompanySettings, EmployeeRole } from "@/types/index";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Dept = {
  id: string;
  name: string;
  incentive_enabled: boolean;
};

type Cat = {
  id: string;
  label: string;
  code: string;
  sort_order: number;
  is_active: boolean;
};

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "approver", label: "第1承認ロール（approver）" },
  { value: "owner", label: "最終承認ロール（owner / 経営）" },
  { value: "staff", label: "スタッフ（通常は選択しない）" },
];

export function CompanyTenantSettings({
  initialCompany,
}: {
  initialCompany: Company;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany);
  const [steps, setSteps] = useState(initialCompany.settings.approval.steps);
  const flow: CompanySettings["approval"]["flow"] =
    steps.length >= 2 ? "two_step" : "one_step";
  const [lineCh, setLineCh] = useState(
    initialCompany.settings.notification.channels.includes("line"),
  );
  const [emailCh, setEmailCh] = useState(
    initialCompany.settings.notification.channels.includes("email"),
  );
  const [useDeptFlag, setUseDeptFlag] = useState(
    initialCompany.settings.incentive.use_department_incentive_flag,
  );
  const [incentiveNotes, setIncentiveNotes] = useState(
    initialCompany.settings.incentive.notes ?? "",
  );
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reloadLists = useCallback(async () => {
    const [dRes, cRes] = await Promise.all([
      fetch("/api/settings/departments"),
      fetch("/api/settings/expense-categories"),
    ]);
    const dj = (await dRes.json()) as { departments?: Dept[]; error?: string };
    const cj = (await cRes.json()) as { categories?: Cat[]; error?: string };
    if (dRes.ok && dj.departments) setDepartments(dj.departments);
    if (cRes.ok && cj.categories) setCategories(cj.categories);
  }, []);

  useEffect(() => {
    void reloadLists();
  }, [reloadLists]);

  async function saveSettings() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const channels: ("line" | "email")[] = [];
      if (lineCh) channels.push("line");
      if (emailCh) channels.push("email");
      const ordered = steps.map((s, i) => ({ ...s, order: i + 1 }));
      const derivedFlow: CompanySettings["approval"]["flow"] =
        ordered.length >= 2 ? "two_step" : "one_step";

      const res = await fetch("/api/company/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            approval: { flow: derivedFlow, steps: ordered },
            notification: { channels: channels.length ? channels : ["line"] },
            incentive: {
              use_department_incentive_flag: useDeptFlag,
              notes: incentiveNotes.trim() || undefined,
            },
          },
        }),
      });
      const j = (await res.json()) as { error?: string; settings?: CompanySettings };
      if (!res.ok) {
        setErr(j.error ?? "保存に失敗しました");
        return;
      }
      if (j.settings) {
        setCompany((c) => ({ ...c, settings: j.settings! }));
      }
      setMsg("保存しました");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeptIncentive(id: string, on: boolean) {
    setErr(null);
    const res = await fetch("/api/settings/departments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, incentive_enabled: on }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "部署の更新に失敗しました");
      return;
    }
    await reloadLists();
    setMsg("部署のインセンティブ設定を更新しました");
  }

  async function addCategory() {
    const label = newLabel.trim();
    if (!label) return;
    setErr(null);
    const res = await fetch("/api/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "追加に失敗しました");
      return;
    }
    setNewLabel("");
    await reloadLists();
    setMsg("カテゴリを追加しました");
  }

  async function patchCategory(id: string, patch: Partial<Cat>) {
    setErr(null);
    const res = await fetch("/api/settings/expense-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "更新に失敗しました");
      return;
    }
    await reloadLists();
  }

  function setTwoStepDefaults() {
    setSteps([
      { order: 1, approver_role: "approver", label: "第1承認" },
      { order: 2, approver_role: "owner", label: "最終承認" },
    ]);
  }

  function setOneStepDefault() {
    setSteps([{ order: 1, approver_role: "owner", label: "承認" }]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <p className="text-sm text-zinc-500">
          テナント ID <code className="text-xs">{company.id}</code>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          会社設定（SaaS・テナント）
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          承認フロー・通知チャネル・経費カテゴリ・インセンティブ対象部門はすべて会社（
          <strong className="font-medium">company_id</strong>
          ）単位です。他テナントには影響しません。
        </p>
      </div>

      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          承認フロー
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          段階数と各段階のラベル・承認者ロールを定義します（実際の担当者は profiles.role
          に一致する必要があります）。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={setTwoStepDefaults}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            2段階にリセット
          </button>
          <button
            type="button"
            onClick={setOneStepDefault}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            1段階にリセット
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          現在の保存時フロー:{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-200">
            {flow === "two_step" ? "2段階（以上）" : "1段階"}
          </strong>
        </p>
        <ul className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li
              key={`${s.order}-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <label className="block text-sm">
                <span className="text-zinc-500">ラベル</span>
                <input
                  value={s.label}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = { ...next[i], label: e.target.value };
                    setSteps(next);
                  }}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">承認者ロール</span>
                <select
                  value={s.approver_role}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = {
                      ...next[i],
                      approver_role: e.target.value as EmployeeRole,
                    };
                    setSteps(next);
                  }}
                  className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={steps.length <= 1}
                onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                className="text-sm text-red-600 disabled:opacity-40 dark:text-red-400"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setSteps([
              ...steps,
              {
                order: steps.length + 1,
                approver_role: "owner",
                label: `段階 ${steps.length + 1}`,
              },
            ])
          }
          className="mt-3 text-sm font-medium text-violet-700 underline dark:text-violet-400"
        >
          段階を追加（N段階承認）
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          ※ 段階が2つ以上あると保存時は 2 段階フローとして扱います。
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          通知チャネル
        </h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lineCh}
            onChange={(e) => setLineCh(e.target.checked)}
          />
          LINE
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emailCh}
            onChange={(e) => setEmailCh(e.target.checked)}
          />
          メール（Resend 等の環境変数が必要）
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          インセンティブ（部門フラグ）
        </h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useDeptFlag}
            onChange={(e) => setUseDeptFlag(e.target.checked)}
          />
          部署マスタの incentive_enabled
          をインセンティブ対象判定に使う（オフにすると別ロジック優先の余地あり）
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-zinc-500">社内向けメモ（任意）</span>
          <textarea
            value={incentiveNotes}
            onChange={(e) => setIncentiveNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
          />
        </label>
        <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            部署ごとのインセンティブ対象
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {departments.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span>{d.name}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={d.incentive_enabled}
                    onChange={(e) => void toggleDeptIncentive(d.id, e.target.checked)}
                  />
                  インセンティブ対象部門
                </label>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-card">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          経費カテゴリ
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="新しいカテゴリ名"
            className="min-w-[12rem] flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-card"
          />
          <button
            type="button"
            onClick={() => void addCategory()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            追加
          </button>
        </div>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={c.label}
                  key={c.label + c.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.label) void patchCategory(c.id, { label: v });
                  }}
                  className="w-full rounded border border-zinc-200 px-2 py-1 text-sm font-medium dark:border-zinc-700 dark:bg-card"
                />
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  code: {c.code}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs">
                表示順
                <input
                  type="number"
                  defaultValue={c.sort_order}
                  className="w-16 rounded border px-1 py-0.5 dark:border-zinc-600 dark:bg-card"
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n))
                      void patchCategory(c.id, { sort_order: Math.floor(n) });
                  }}
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={c.is_active}
                  onChange={(e) =>
                    void patchCategory(c.id, { is_active: e.target.checked })
                  }
                />
                有効
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSettings()}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "会社設定を保存"}
        </button>
        <p className="self-center text-xs text-zinc-500">
          承認フロー・通知・インセンティブ方針のメモを companies.settings に書き込みます。
        </p>
      </div>
    </div>
  );
}
