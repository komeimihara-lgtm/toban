"use client";

import {
  changePasswordWithCurrentAction,
  saveProfileSettingsAction,
} from "@/app/actions/profile-actions";
import { useActionState } from "react";

type ProfileData = {
  full_name: string;
  phone: string;
  address: string;
  birth_date: string;
  emergency_name: string;
  emergency_relation: string;
  emergency_contact: string;
  line_user_id: string;
};

export function ProfileForm({
  email,
  profile,
  hireDateLabel,
  departmentLabel,
  jobTitleLabel,
}: {
  email: string;
  profile: ProfileData;
  hireDateLabel: string;
  departmentLabel: string;
  jobTitleLabel: string;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    saveProfileSettingsAction,
    null as { ok: boolean; message?: string } | null,
  );
  const [pwState, pwAction, pwPending] = useActionState(
    changePasswordWithCurrentAction,
    null as { ok: boolean; message?: string } | null,
  );

  const fieldClass =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-50";
  const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          プロフィール
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          連絡先・LINE・パスワードを管理します。入社情報は人事登録に基づき表示されます。
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          社員情報（参照のみ）
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-1">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">入社日</dt>
            <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {hireDateLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">部署</dt>
            <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {departmentLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">役職</dt>
            <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {jobTitleLabel}
            </dd>
          </div>
        </dl>
      </section>

      <form
        action={profileAction}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          連絡先・LINE（編集可）
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">ログインメール: {email}</p>

        <label className={labelClass}>
          氏名
          <input name="full_name" defaultValue={profile.full_name} className={fieldClass} />
        </label>
        <label className={labelClass}>
          電話番号
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={profile.phone}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          住所
          <textarea
            name="address"
            rows={3}
            autoComplete="street-address"
            defaultValue={profile.address}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          LINE ID（通知用）
          <input name="line_user_id" defaultValue={profile.line_user_id} className={fieldClass} />
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          LINE 通知を受け取る場合は、LINE のユーザーIDを登録してください。
        </p>

        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            本人情報
          </h3>
          <div className="mt-4 space-y-4">
            <label className={labelClass}>
              生年月日
              <input
                name="birth_date"
                type="date"
                defaultValue={profile.birth_date}
                className={fieldClass}
              />
            </label>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            緊急連絡先
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            人事安否確認などに利用します。
          </p>
          <div className="mt-4 space-y-4">
            <label className={labelClass}>
              氏名
              <input
                name="emergency_name"
                type="text"
                autoComplete="name"
                placeholder="山田 花子"
                defaultValue={profile.emergency_name}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              続柄
              <input
                name="emergency_relation"
                type="text"
                placeholder="例: 配偶者、父、母"
                defaultValue={profile.emergency_relation}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              電話番号
              <input
                name="emergency_contact"
                type="tel"
                autoComplete="tel"
                placeholder="090-0000-0000"
                defaultValue={profile.emergency_contact}
                className={fieldClass}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={profilePending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {profilePending ? "保存中…" : "プロフィールを保存"}
        </button>
        {profileState?.ok ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">保存しました。</p>
        ) : null}
        {profileState && !profileState.ok && profileState.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{profileState.message}</p>
        ) : null}
      </form>

      <form
        action={pwAction}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          パスワード変更
        </h2>
        <label className={labelClass}>
          現在のパスワード
          <input
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          新しいパスワード（8文字以上）
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          新しいパスワード（確認）
          <input
            name="new_password_confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={pwPending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pwPending ? "更新中…" : "パスワードを更新"}
        </button>
        {pwState?.ok ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            パスワードを更新しました。
          </p>
        ) : null}
        {pwState && !pwState.ok && pwState.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{pwState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
