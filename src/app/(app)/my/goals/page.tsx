import { redirect } from "next/navigation";

export default function MyGoalsRedirectPage() {
  redirect("/my/self-management?tab=goals");
}
