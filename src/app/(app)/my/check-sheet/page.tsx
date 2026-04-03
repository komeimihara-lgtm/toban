import { redirect } from "next/navigation";

export default function MyCheckSheetRedirectPage() {
  redirect("/my/self-management?tab=check");
}
