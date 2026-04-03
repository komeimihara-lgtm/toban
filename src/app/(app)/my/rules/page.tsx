import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RulesClient } from "./rules-client";

export const dynamic = "force-dynamic";

export default async function MyRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = emp as { role?: string; company_id?: string } | null;
  if (!profile?.company_id) redirect("/my");

  const { data: docs } = await supabase
    .from("company_documents")
    .select("id, name, file_path, document_type, ai_summary, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  const canUpload = profile.role === "owner" || profile.role === "approver";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">就業規則</h1>
      <RulesClient
        initialDocuments={docs ?? []}
        canUpload={canUpload}
      />
    </div>
  );
}
