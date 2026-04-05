"use client";

import type { CompanySettings } from "@/types/index";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CompanyData = {
  id: string;
  name: string;
  settings: CompanySettings;
};

export function CompanyTenantSettings({
  initialCompany,
}: {
  initialCompany: CompanyData;
}) {
  const router = useRouter();
  const [lineCh, setLineCh] = useState(
    initialCompany.settings.notification.channels.includes("line"),
  );
  const [emailCh, setEmailCh] = useState(
    initialCompany.settings.notification.channels.includes("email"),
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveSettings() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const channels: ("line" | "email")[] = [];
      if (lineCh) channels.push("line");
      if (emailCh) channels.push("email");

      const res = await fetch("/api/company/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            notification: { channels: channels.length ? channels : ["line"] },
          },
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "保存に失敗しました");
        return;
      }
      setMsg("保存しました");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <p className="text-sm text-zinc-500">
          テナント ID <code className="text-xs">{initialCompany.id}</code>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1A1A1A]">
          店舗設定
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          通知チャネルなどの基本設定を管理します。
        </p>
      </div>

      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1A1A1A]">
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
          メール
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSettings()}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
