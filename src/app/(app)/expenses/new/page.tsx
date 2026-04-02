import { redirect } from "next/navigation";

/** 個人の経費申請は /my/expenses/new に統一 */
export default function ExpensesNewRedirectPage() {
  redirect("/my/expenses/new");
}
