"use client";

import { createBrowserClient } from "@supabase/ssr";
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

    const { data: empRow } = await supabase
      .from("employees")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const role = (empRow as { role?: string } | null)?.role ?? "staff";

    const isAdmin = role === "owner";
    let dest = isAdmin ? "/dashboard" : "/my";
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      if (nextPath === "/login") {
        /* keep default dest */
      } else if (isAdmin) {
        dest = nextPath;
      } else {
        const staffOk =
          nextPath === "/my" || nextPath.startsWith("/my/");
        if (staffOk) dest = nextPath;
      }
    }

    router.push(dest);
    router.refresh();
    setPending(false);
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">ログイン</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        アカウントでサインインしてください
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[#6B7280]"
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
            className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[#1A1A1A] placeholder:text-gray-400 focus:border-[#FF6B2B] focus:outline-none focus:ring-1 focus:ring-[#FF6B2B]"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[#6B7280]"
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
            className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[#1A1A1A] placeholder:text-gray-400 focus:border-[#FF6B2B] focus:outline-none focus:ring-1 focus:ring-[#FF6B2B]"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#FF6B2B] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#FF8C00] disabled:opacity-50"
        >
          {pending ? "ログインしています…" : "ログイン"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-[#6B7280]">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-[#FF6B2B]"
        >
          トップへ戻る
        </Link>
      </p>
    </div>
  );
}
