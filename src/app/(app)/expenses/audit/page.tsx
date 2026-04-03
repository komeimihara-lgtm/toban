import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/require-admin";
import { ExpenseAuditReportClient } from "./expense-audit-report-client";

export const dynamic = "force-dynamic";

export default async function ExpensesAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkAdminRole(supabase, user.id))) redirect("/my");

  const now = new Date();

  return (
    <div className="min-h-screen bg-zinc-50/80 px-4 py-8 dark:bg-zinc-950">
      <div className="mb-6 text-sm">
        <Link href="/expenses" className="text-zinc-600 underline dark:text-zinc-400">
          ← 経費一覧
        </Link>
      </div>
      <ExpenseAuditReportClient
        defaultYear={now.getFullYear()}
        defaultMonth={now.getMonth() + 1}
      />
    </div>
  );
}
