import { redirect } from "next/navigation";

export default function MyGrowthRedirectPage() {
  redirect("/my/self-management?tab=growth");
}
