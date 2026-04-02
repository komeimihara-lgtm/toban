import { redirect } from "next/navigation";

/** スキャフォールド互換: 休暇はマイページ配下 */
export default function LeaveAliasPage() {
  redirect("/my/leave");
}
