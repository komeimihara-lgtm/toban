"use client";

import {
  changePasswordWithCurrentAction,
  saveProfileSettingsAction,
} from "@/app/actions/profile-actions";
import { createBrowserClient } from "@supabase/ssr";
import { useActionState, useEffect, useState } from "react";

function formatDateJa(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [initialName, setInitialName] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [initialAddress, setInitialAddress] = useState("");
  const [initialBirthDate, setInitialBirthDate] = useState("");
  const [initialEmergencyName, setInitialEmergencyName] = useState("");
  const [initialEmergencyRelation, setInitialEmergencyRelation] = useState("");
  const [initialEmergencyPhone, setInitialEmergencyPhone] = useState("");
  const [initialLine, setInitialLine] = useState("");
  const [hireDateLabel, setHireDateLabel] = useState("—");
  const [departmentLabel, setDepartmentLabel] = useState("—");
  const [jobTitleLabel, setJobTitleLabel] = useState("—");
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
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");

      const { data: emp } = await supabase
        .from("employees")
        .select(
          "id, full_name, phone, address, emergency_contact, emergency_name, emergency_relation, birth_date, line_user_id, department, job_title, department_id",
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const p = emp as {
        full_name?: string | null;
        phone?: string | null;
        address?: string | null;
        emergency_contact?: string | null;
        emergency_name?: string | null;
        emergency_relation?: string | null;
        birth_date?: string | null;
        line_user_id?: string | null;
        department?: string | null;
        job_title?: string | null;
        department_id?: string | null;
      } | null;

      setInitialName(p?.full_name?.trim() ?? "");
      setInitialPhone(p?.phone?.trim() ?? "");
      setInitialAddress(p?.address?.trim() ?? "");
      const bd = p?.birth_date?.trim();
      if (bd) {
        setInitialBirthDate(bd.length >= 10 ? bd.slice(0, 10) : bd);
      } else {
        setInitialBirthDate("");
      }
      setInitialEmergencyName(p?.emergency_name?.trim() ?? "");
      setInitialEmergencyRelation(p?.emergency_relation?.trim() ?? "");
      setInitialEmergencyPhone(p?.emergency_contact?.trim() ?? "");
      setInitialLine(p?.line_user_id?.trim() ?? "");

      let deptFromMaster: string | null = null;
      const depId = p?.department_id;
      if (depId) {
        const { data: depRow } = await supabase
          .from("departments")
          .select("name")
          .eq("id", depId)
          .maybeSingle();
        deptFromMaster =
          (depRow as { name?: string | null } | null)?.name?.trim() ?? null;
      }
      const dept =
        (p?.department?.trim() && p.department.trim().length > 0
          ? p.department.trim()
          : null) ?? deptFromMaster;
      setDepartmentLabel(dept ?? "—");
      setJobTitleLabel(p?.job_title?.trim() || "—");

      const empPk = (emp as { id?: string } | null)?.id;
      const { data: contract } = empPk
        ? await supabase
            .from("employment_contracts")
            .select("hire_date, start_date")
            .eq("employee_id", empPk)
            .maybeSingle()
        : { data: null };

      const c = contract as {
        hire_date?: string | null;
        start_date?: string | null;
      } | null;
      const hd = c?.hire_date ?? c?.start_date ?? null;
      setHireDateLabel(formatDateJa(hd));

      setFormKey((k) => k + 1);
      setLoading(false);
    }
    void load();
  }, []);

  const fieldClass =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-50";
  const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中…</p>;
  }

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
        key={`prof-${formKey}`}
        action={profileAction}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          連絡先・LINE（編集可）
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">ログインメール: {email}</p>

        <label className={labelClass}>
          氏名
          <input name="full_name" defaultValue={initialName} className={fieldClass} />
        </label>
        <label className={labelClass}>
          電話番号
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={initialPhone}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          住所
          <textarea
            name="address"
            rows={3}
            autoComplete="street-address"
            defaultValue={initialAddress}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          LINE ID（通知用）
          <input name="line_user_id" defaultValue={initialLine} className={fieldClass} />
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          LINE 通知を受け取る場合は、LINE のユーザーIDを登録してください。
        </p>

        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            緊急連絡先・個人情報
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            生年月日・緊急連絡先は人事安否確認などに利用します。
          </p>
          <div className="mt-4 space-y-4">
            <label className={labelClass}>
              生年月日
              <input
                name="birth_date"
                type="date"
                defaultValue={initialBirthDate}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              緊急連絡先・氏名
              <input
                name="emergency_name"
                type="text"
                autoComplete="name"
                placeholder="山田 花子"
                defaultValue={initialEmergencyName}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              緊急連絡先・続柄
              <input
                name="emergency_relation"
                type="text"
                placeholder="例: 配偶者、父、母"
                defaultValue={initialEmergencyRelation}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              緊急連絡先・電話番号
              <input
                name="emergency_contact"
                type="tel"
                autoComplete="tel"
                placeholder="090-0000-0000"
                defaultValue={initialEmergencyPhone}
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
