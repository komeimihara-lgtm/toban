import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /dashboard → / にリダイレクト */
export default function DashboardPage() {
  redirect("/");
}
