export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        入社手続き
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        入社後のチェックリスト（onboarding_tasks と連携）
      </p>
    </div>
  );
}
