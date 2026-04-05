import { LoginForm } from "./login-form";
import { Building2 } from "lucide-react";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0c1222] to-slate-900 px-4 py-12 text-slate-100">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/15 shadow-lg shadow-blue-950/40"
          aria-hidden
        >
          <Building2 className="size-7 text-blue-400" strokeWidth={1.75} />
        </div>
        <header className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            TOBAN
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            TOBAN
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            お店とバイトをつなぐ、当番管理アプリ
          </p>
        </header>

        <Suspense
          fallback={
            <div className="flex h-40 w-full max-w-md items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 text-sm text-slate-400 backdrop-blur-md">
              読み込み中…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-8 max-w-md text-center text-[11px] leading-relaxed text-slate-500">
          お困りの際は人事担当までご連絡ください。
        </p>
      </div>
    </div>
  );
}
