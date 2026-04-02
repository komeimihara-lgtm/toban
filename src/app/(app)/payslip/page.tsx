import { redirect } from "next/navigation";

/** スキャフォールド互換: 給与はマイページ配下に集約 */
export default function PayslipAliasPage() {
  redirect("/my/payslip");
}
