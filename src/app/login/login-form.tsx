"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isAdminRole } from "@/types/incentive";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function jaAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "メールアドレスまたはパスワードが正しくありません。";
  if (m.includes("email not confirmed"))
    return "メールアドレスの確認が完了していません。受信トレイをご確認ください。";
  if (m.includes("too many requests")) return "試行回数が多すぎます。しばらくしてからお試しください。";
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      setError("Supabase が未設定です。");
      setPending(false);
      return;
    }
    const supabase = createBrowserClient(url, anon);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      setError(jaAuthError(signErr.message));
      setPending(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインに失敗しました。");
      setPending(false);
      return;
    }

    const { data: pr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (pr as { role?: string } | null)?.role ?? "staff";

    let dest = isAdminRole(role) ? "/dashboard" : "/my";
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      const admin = isAdminRole(role);
      if (nextPath === "/login") {
        /* keep default dest */
      } else if (admin) {
        dest = nextPath;
      } else {
        const staffOk =
          nextPath === "/my" ||
          nextPath.startsWith("/my/") ||
          nextPath === "/onboarding" ||
          (nextPath.startsWith("/onboarding/") && !nextPath.startsWith("/onboarding/admin")) ||
          nextPath === "/hr-ai" ||
          nextPath.startsWith("/hr-ai/") ||
          nextPath === "/my/hr-ai" ||
          nextPath.startsWith("/my/hr-ai/");
        if (staffOk) dest = nextPath;
      }
    }

    router.push(dest);
    router.refresh();
    setPending(false);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/55 p-8 shadow-xl shadow-black/25 backdrop-blur-md">
      <h2 className="text-lg font-semibold text-white">ログイン</h2>
      <p className="mt-1 text-sm text-slate-400">
        会社アカウントでサインインしてください
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-400"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="mt-1.5 w-full rounded-lg border border-slate-600/70 bg-slate-950/80 px-3 py-2.5 text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-400"
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-600/70 bg-slate-950/80 px-3 py-2.5 text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? "ログインしています…" : "ログイン"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-slate-300"
        >
          トップへ戻る
        </Link>
      </p>
    </div>
  );
}
