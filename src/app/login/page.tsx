import { LoginForm } from "./login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 text-[#1A1A1A]">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-[#FF6B2B] shadow-md shadow-orange-200"
          aria-hidden
        >
          <span className="text-2xl font-black text-white">T</span>
        </div>
        <header className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
            TOBAN
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#FF6B2B]">
            TOBAN
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            お店とバイトをつなぐ、当番管理アプリ
          </p>
        </header>

        <Suspense
          fallback={
            <div className="flex h-40 w-full max-w-md items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#6B7280]">
              読み込み中…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-8 max-w-md text-center text-[11px] leading-relaxed text-[#6B7280]">
          お困りの際は管理者までご連絡ください。
        </p>
      </div>
    </div>
  );
}
