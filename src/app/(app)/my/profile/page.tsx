"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

export default function MyProfilePage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) {
        setLoading(false);
        return;
      }
      const supabase = createBrowserClient(url, anon);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "");
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, line_user_id")
          .eq("id", user.id)
          .maybeSingle();
        const pr = p as { full_name?: string; line_user_id?: string } | null;
        if (pr?.full_name) setDisplayName(pr.full_name);
        if (pr?.line_user_id) setLineUserId(pr.line_user_id);
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    const supabase = createBrowserClient(url, anon);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: displayName || null,
        line_user_id: lineUserId || null,
      })
      .eq("id", user.id);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("保存しました");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (newPw !== newPw2) {
      setErr("新しいパスワードが一致しません");
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    const supabase = createBrowserClient(url, anon);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("パスワードを更新しました");
    setNewPw("");
    setNewPw2("");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">プロフィール・設定</h1>

      <form
        onSubmit={saveProfile}
        className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium text-zinc-500">表示名・LINE</h2>
        <p className="text-xs text-zinc-500">メール: {email}</p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="表示名"
          className="w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-600">
          LINEで通知を受け取るには LINE ユーザーID を登録してください。
        </p>
        <input
          value={lineUserId}
          onChange={(e) => setLineUserId(e.target.value)}
          placeholder="line_user_id"
          className="w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          プロフィール保存
        </button>
      </form>

      <form
        onSubmit={changePassword}
        className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium text-zinc-500">パスワード変更</h2>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="新しいパスワード"
          className="w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900"
        />
        <input
          type="password"
          value={newPw2}
          onChange={(e) => setNewPw2(e.target.value)}
          placeholder="確認"
          className="w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          パスワード更新
        </button>
      </form>

      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
