"use client";

import { useState } from "react";

type Doc = {
  id: string;
  name: string;
  file_path: string;
  document_type: string;
  ai_summary: string | null;
  created_at: string;
};

export function RulesClient({ initialDocuments }: { initialDocuments: Doc[] }) {
  const [docs] = useState(initialDocuments);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewName, setViewName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string, ms = 3000) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  async function openPdf(doc: Doc) {
    setLoading(doc.id);
    try {
      const res = await fetch("/api/company-documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: doc.file_path }),
      });
      if (!res.ok) {
        showToast("ファイルを開けませんでした");
        return;
      }
      const { url } = await res.json();
      setViewUrl(url);
      setViewName(doc.name);
    } catch {
      showToast("ファイルを開けませんでした");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">ドキュメント一覧</h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">就業規則が登録されていません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {docs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openPdf(doc)}
                    disabled={loading === doc.id}
                    className="text-left text-sm font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {loading === doc.id ? "読み込み中..." : doc.name}
                  </button>
                  <p className="text-xs text-zinc-400">
                    {new Date(doc.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewUrl ? (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{viewName}</h2>
            <button
              type="button"
              onClick={() => {
                setViewUrl(null);
                setViewName("");
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              閉じる
            </button>
          </div>
          <iframe
            src={viewUrl}
            className="mt-3 h-[70vh] w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
            title={viewName}
          />
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      ) : null}
    </>
  );
}
