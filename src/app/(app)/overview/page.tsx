import { redirect } from "next/navigation";

/** 旧URL互換 */
export default function OverviewRedirectPage() {
  redirect("/");
}
