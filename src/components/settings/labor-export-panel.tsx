"use client";

import { useMemo, useState } from "react";

function pad2(m: number) {
  return String(m).padStart(2, "0");
}

export function LaborExportPanel() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function download(type: "attendance" | "incentive" | "expense" | "all") {
    setBusy(type);
    setMsg(null);
    try {
      const r = await fetch(`/api/export?type=${type}&year=${year}&month=${month}`, {
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "ダウンロードに失敗しました");
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition");
      let fn = "export.bin";
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) fn = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fn;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">社労士提出用データ出力</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          指定した月の勤怠・インセンティブ・経費を Excel（.xlsx）で取得します。一括は ZIP です。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-xs text-zinc-500">年</span>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">月</span>
          <select
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {pad2(m)}月
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {msg}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:max-w-md">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void download("attendance")}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {busy === "attendance" ? "生成中…" : "勤怠データを Excel で出力"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void download("incentive")}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {busy === "incentive" ? "生成中…" : "インセンティブを Excel で出力"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void download("expense")}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {busy === "expense" ? "生成中…" : "経費データを Excel で出力"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void download("all")}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {busy === "all" ? "生成中…" : "全データを一括出力（ZIP）"}
        </button>
      </div>
    </div>
  );
}
