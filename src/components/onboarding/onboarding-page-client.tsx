"use client";

import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  status: string;
  completed?: boolean | null;
};

type Doc = {
  id: string;
  file_name: string | null;
  document_type: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

export function OnboardingPageClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [employeeRecordId, setEmployeeRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "読み込み失敗");
      setTasks(j.tasks ?? []);
      setDocuments(j.documents ?? []);
      setEmployeeRecordId(j.employee_record_id ?? null);

      if ((j.tasks?.length ?? 0) === 0 && j.employee_record_id) {
        const gen = await fetch("/api/onboarding", { method: "POST" });
        const gj = await gen.json();
        if (gen.ok && !gj.skipped) {
          const res2 = await fetch("/api/onboarding");
          const j2 = await res2.json();
          if (res2.ok) {
            setTasks(j2.tasks ?? []);
          }
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completedCount = tasks.filter(
    (t) => t.status === "completed" || t.completed === true,
  ).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  async function completeTask(id: string) {
    setBusyTask(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/onboarding/${id}/complete`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "更新に失敗しました");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusyTask(null);
    }
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (uploadTaskId) fd.set("task_id", uploadTaskId);
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/onboarding/documents", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "アップロードに失敗しました");
      form.reset();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラー");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  if (!employeeRecordId) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-card">
        <p>従業員レコードがまだありません。管理者に連絡するか、しばらくしてから再度お試しください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {message}
        </p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            進捗
          </h2>
          <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {completedCount} / {tasks.length}（{progress}%）
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-card/80">
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          チェックリスト
        </h2>
        <ul className="space-y-3">
          {tasks.map((t) => {
            const done = t.status === "completed" || t.completed === true;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {done ? "✓ " : ""}
                      {t.title}
                    </p>
                    {t.description ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {t.description}
                      </p>
                    ) : null}
                  </div>
                  {!done ? (
                    <button
                      type="button"
                      disabled={busyTask === t.id}
                      onClick={() => void completeTask(t.id)}
                      className="shrink-0 rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
                    >
                      {busyTask === t.id ? "処理中…" : "完了にする"}
                    </button>
                  ) : (
                    <span className="text-sm text-emerald-600">完了</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          書類アップロード
        </h2>
        <form onSubmit={onUpload} className="max-w-lg space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              関連タスク（任意）
            </label>
            <select
              value={uploadTaskId}
              onChange={(e) => setUploadTaskId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-card"
            >
              <option value="">（指定なし）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              ファイル
            </label>
            <input
              name="file"
              type="file"
              required
              disabled={uploading}
              className="mt-1 w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              書類区分（任意）
            </label>
            <input
              name="document_type"
              type="text"
              placeholder="例: 雇用契約書"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-card"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
          >
            {uploading ? "アップロード中…" : "アップロード"}
          </button>
        </form>

        {documents.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                {d.signed_url ? (
                  <a
                    href={d.signed_url}
            target="_blank"
            rel="noopener noreferrer"
                    className="underline"
                  >
                    {d.file_name ?? d.document_type ?? "ファイル"}
                  </a>
                ) : (
                  <span>{d.file_name}</span>
                )}
                <span className="text-xs text-zinc-500">
                  {new Date(d.uploaded_at).toLocaleString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
