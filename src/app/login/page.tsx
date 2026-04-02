import { LoginForm } from "./login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200/80 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <header className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            LENARD HR
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            レナード株式会社
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            人事・勤怠・経費・給与ポータル
          </p>
        </header>

        <Suspense
          fallback={
            <div className="flex h-40 w-full max-w-md items-center justify-center rounded-2xl border border-zinc-200 bg-white/80 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
              読み込み中…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-8 max-w-md text-center text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
          お困りの際は人事担当までご連絡ください。
        </p>
      </div>
    </div>
  );
}
