import { redirect } from "next/navigation";

/** みなし残業・勤怠サマリーは給与明細ページに集約（freee 連携） */
export default function OvertimeAliasPage() {
  redirect("/my/payslip");
}
