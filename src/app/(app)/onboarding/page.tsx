import { OnboardingPageClient } from "@/components/onboarding/onboarding-page-client";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          入社手続き
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          チェックリストに沿って必要書類を提出し、各項目を完了にしてください。
        </p>
      </header>
      <OnboardingPageClient />
    </div>
  );
}
