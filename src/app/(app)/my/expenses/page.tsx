export const dynamic = "force-dynamic";

export default function MyExpensesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        経費申請・申請状況
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        経費申請と申請状況の一覧（同一画面でタブ切替予定）
      </p>
    </div>
  );
}
