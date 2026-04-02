"use client";

import {
  changePasswordWithCurrentAction,
  saveProfileSettingsAction,
} from "@/app/actions/profile-actions";
import { createBrowserClient } from "@supabase/ssr";
import { useActionState, useEffect, useState } from "react";

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [initialName, setInitialName] = useState("");
  const [initialLine, setInitialLine] = useState("");
  const [formKey, setFormKey] = useState(0);

  const [profileState, profileAction, profilePending] = useActionState(
    saveProfileSettingsAction,
    null as { ok: boolean; message?: string } | null,
  );
  const [pwState, pwAction, pwPending] = useActionState(
    changePasswordWithCurrentAction,
    null as { ok: boolean; message?: string } | null,
  );

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
        setInitialName(pr?.full_name?.trim() ?? "");
        setInitialLine(pr?.line_user_id?.trim() ?? "");
        setFormKey((k) => k + 1);
      }
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          プロフィール設定
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          表示名・LINE 通知・パスワードを管理します。
        </p>
      </div>

      <form
        key={`prof-${formKey}`}
        action={profileAction}
        className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium text-zinc-500">表示名・LINE 通知</h2>
        <p className="text-xs text-zinc-500">ログインメール: {email}</p>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          表示名
          <input
            name="full_name"
            defaultValue={initialName}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <p className="text-xs text-zinc-600">
          LINE 通知を受け取る場合は、LINE のユーザーIDを登録してください。
        </p>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          LINE ユーザーID
          <input
            name="line_user_id"
            defaultValue={initialLine}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={profilePending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {profilePending ? "保存中…" : "プロフィールを保存"}
        </button>
        {profileState?.ok ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">保存しました。</p>
        ) : null}
        {profileState && !profileState.ok && profileState.message ? (
          <p className="text-sm text-red-600">{profileState.message}</p>
        ) : null}
      </form>

      <form
        action={pwAction}
        className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium text-zinc-500">パスワード変更</h2>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          現在のパスワード
          <input
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          新しいパスワード（8文字以上）
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          新しいパスワード（確認）
          <input
            name="new_password_confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={pwPending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pwPending ? "更新中…" : "パスワードを更新"}
        </button>
        {pwState?.ok ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            パスワードを更新しました。
          </p>
        ) : null}
        {pwState && !pwState.ok && pwState.message ? (
          <p className="text-sm text-red-600">{pwState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
