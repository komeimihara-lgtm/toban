"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

function pickPdfFiles(list: FileList | File[]) {
  return Array.from(list).filter(
    (f) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
  );
}

type Doc = {
  id: string;
  name: string;
  file_path: string;
  document_type: string;
  ai_summary: string | null;
  created_at: string;
};

export function RulesClient({
  initialDocuments,
  canUpload,
}: {
  initialDocuments: Doc[];
  canUpload: boolean;
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewName, setViewName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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

  function applyPickedFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const pdfs = pickPdfFiles(fileList);
    if (pdfs.length === 0) {
      showToast("PDFファイルを選択してください");
      return;
    }
    setSelectedFiles(pdfs);
  }

  async function handleUpload() {
    const fromInput = fileRef.current?.files;
    const files =
      selectedFiles.length > 0
        ? selectedFiles
        : fromInput
          ? pickPdfFiles(fromInput)
          : [];
    if (files.length === 0) {
      showToast("PDFファイルをドロップまたは選択してください");
      return;
    }
    const nameOne = uploadName.trim();
    if (files.length === 1 && !nameOne) {
      showToast("ドキュメント名を入力してください");
      return;
    }

    setUploading(true);
    try {
      const uploaded: Doc[] = [];
      for (const file of files) {
        const name =
          files.length === 1 && nameOne
            ? nameOne
            : file.name.replace(/\.pdf$/i, "") || file.name;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", name);
        const res = await fetch("/api/company-documents", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(
            (err as { error?: string }).error ?? "アップロードに失敗しました",
          );
          return;
        }
        const { document: newDoc } = await res.json();
        uploaded.push({ ...newDoc, ai_summary: null } as Doc);
      }
      setDocs((prev) => [...uploaded, ...prev]);
      setUploadName("");
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      showToast(
        uploaded.length > 1
          ? `アップロードしました（${uploaded.length}件）`
          : "アップロードしました",
      );
    } catch {
      showToast("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このドキュメントを削除しますか？")) return;
    try {
      const res = await fetch("/api/company-documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        showToast("削除に失敗しました");
        return;
      }
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (viewUrl) {
        setViewUrl(null);
        setViewName("");
      }
      showToast("削除しました");
    } catch {
      showToast("削除に失敗しました");
    }
  }

  return (
    <>
      {/* アップロードフォーム（owner/approverのみ） */}
      {canUpload && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">ドキュメントをアップロード</h2>
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <label className="block text-xs text-zinc-500">ドキュメント名</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="例: 就業規則（2026年4月版）"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              {selectedFiles.length > 1 ? (
                <p className="mt-1 text-xs text-zinc-400">
                  複数ファイル時は各PDFのファイル名がドキュメント名として使われます（上記は無視されます）。
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">PDF ファイル</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="sr-only"
                onChange={(e) => applyPickedFiles(e.target.files)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    fileRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  applyPickedFiles(e.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-600 bg-transparent"
                }`}
              >
                <Upload
                  className="mb-3 size-10 text-zinc-400 dark:text-zinc-500"
                  aria-hidden
                />
                <p className="text-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  PDFをここにドラッグ＆ドロップ
                </p>
                <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  またはクリックして選択
                </p>
                {selectedFiles.length > 0 ? (
                  <ul className="mt-4 max-h-32 w-full max-w-md list-inside list-disc overflow-y-auto text-left text-xs text-zinc-600 dark:text-zinc-300">
                    {selectedFiles.map((f) => (
                      <li key={`${f.name}-${f.size}-${f.lastModified}`} className="truncate">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 sm:w-auto"
            >
              {uploading ? "アップロード中..." : "アップロード"}
            </button>
          </div>
        </div>
      )}

      {/* ドキュメント一覧 */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">ドキュメント一覧</h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">就業規則が登録されていません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <button
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
                {canUpload && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PDFビューワー */}
      {viewUrl && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{viewName}</h2>
            <button
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
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </>
  );
}
