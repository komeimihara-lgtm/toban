"use client";

import { ProfileForm } from "./profile-form";

type ProfileProps = {
  full_name: string;
  phone: string;
  address: string;
  birth_date: string;
  emergency_name: string;
  emergency_relation: string;
  emergency_contact: string;
  line_user_id: string;
};

export function ProfilePageTabs({
  email,
  profile,
  departmentLabel,
}: {
  email: string;
  profile: ProfileProps;
  departmentLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          プロフィール
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          基本情報を管理します。
        </p>
      </div>

      <ProfileForm
        email={email}
        profile={profile}
        hireDateLabel="—"
        departmentLabel={departmentLabel}
        jobTitleLabel="—"
      />
    </div>
  );
}
