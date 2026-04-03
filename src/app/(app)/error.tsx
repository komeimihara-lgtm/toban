"use client";

export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-8 text-foreground">
      <h1 className="text-xl font-bold text-red-600 dark:text-red-400">
        画面の表示に失敗しました
      </h1>
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        データの読み込みでエラーが発生しています。Supabase の接続・テーブル・マイグレーション（RLS
        含む）を確認してください。「再試行」でリロードできます。
      </p>
      <p className="break-all rounded-md bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-card dark:text-zinc-200">
        {error.message}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-900"
      >
        再試行
      </button>
    </div>
  );
}
