import { OffboardingPageClient } from "@/components/offboarding/offboarding-page-client";

export const dynamic = "force-dynamic";

export default function OffboardingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          退社手続き
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          退職日・最終出勤日を確認し、チェックリストを進めてください。
        </p>
      </header>
      <OffboardingPageClient />
    </div>
  );
}
