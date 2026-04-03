"use client";

import { useState } from "react";
import { ProfileForm } from "./profile-form";
import { OnboardingPageClient } from "@/components/onboarding/onboarding-page-client";

type ContractData = {
  baseSalary: string;
  deemedOvertimeHours: string;
  deemedOvertimeAmount: string;
  startDate: string;
  trialEndDate: string;
  commutes: {
    routeName: string;
    transportation: string;
    ticketType: string;
    monthlyAmount: string;
  }[];
  paidLeave: {
    daysRemaining: string;
    nextGrantYmd: string;
    nextGrantDelta: string;
    cacheNext: string;
    cacheDays: string;
    plbNextAccrualDate: string;
    plbNextAccrualDays: string;
  };
  noContract: boolean;
};

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

const TABS = ["基本情報", "雇用契約内容", "入社手続き"] as const;

export function ProfilePageTabs({
  email,
  profile,
  hireDateLabel,
  departmentLabel,
  jobTitleLabel,
  contract,
}: {
  email: string;
  profile: ProfileProps;
  hireDateLabel: string;
  departmentLabel: string;
  jobTitleLabel: string;
  contract: ContractData;
}) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          プロフィール
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          基本情報・雇用契約・入社手続きを管理します。
        </p>
      </div>

      <div className="flex gap-2 border-b border-zinc-700 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "基本情報" && (
        <ProfileForm
          email={email}
          profile={profile}
          hireDateLabel={hireDateLabel}
          departmentLabel={departmentLabel}
          jobTitleLabel={jobTitleLabel}
        />
      )}

      {activeTab === "雇用契約内容" && (
        <ContractTab contract={contract} />
      )}

      {activeTab === "入社手続き" && (
        <div className="space-y-6">
          <header>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              入社手続き
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              チェックリストに沿って必要書類を提出し、各項目を完了にしてください。
            </p>
          </header>
          <OnboardingPageClient />
        </div>
      )}
    </div>
  );
}

function ContractTab({ contract }: { contract: ContractData }) {
  if (contract.noContract) {
    return (
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
        role="alert"
      >
        <p className="text-lg font-semibold">契約情報が見つかりません</p>
        <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  const c = contract;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          雇用契約内容（閲覧のみ）
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          表示されている情報の変更は人事担当までお問い合わせください。
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">基本条件</h3>
        <dl className="mt-4 grid gap-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">基本給</dt>
            <dd className="font-medium tabular-nums">{c.baseSalary}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">みなし残業（時間・金額）</dt>
            <dd className="tabular-nums">
              {c.deemedOvertimeHours} / {c.deemedOvertimeAmount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">入社日</dt>
            <dd className="tabular-nums">{c.startDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">試用期間（満了日）</dt>
            <dd className="tabular-nums">{c.trialEndDate}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">通勤費（登録中）</h3>
        {c.commutes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">有効な通勤費登録がありません。</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {c.commutes.map((m, i) => (
              <li
                key={i}
                className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <p className="font-medium">{m.routeName}</p>
                <p className="text-xs text-zinc-500">
                  {m.transportation} · {m.ticketType} · 月額 {m.monthlyAmount}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          有給（参考・次回付与）
        </h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">残日数（キャッシュ）</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {c.paidLeave.daysRemaining}{" "}
              <span className="text-base font-normal text-zinc-500">日</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">次回付与日・付与予定日数（システム計算）</dt>
            <dd className="tabular-nums">
              {c.paidLeave.nextGrantYmd}
              {c.paidLeave.nextGrantDelta}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">契約マスタ上の次回有給（列がある場合）</dt>
            <dd className="tabular-nums">
              {c.paidLeave.cacheNext}
              {c.paidLeave.cacheDays}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">paid_leave_balances の次回付与</dt>
            <dd className="tabular-nums">
              {c.paidLeave.plbNextAccrualDate}
              {c.paidLeave.plbNextAccrualDays}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
