import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentsAdminClient } from "./documents-admin-client";
import { resolveUserRole } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

function isCompanyDocumentsAdmin(role: string) {
  return role === "owner" || role === "director";
}

export default async function CompanyDocumentsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveUserRole(supabase, user.id);
  if (!isCompanyDocumentsAdmin(role)) redirect("/my");

  const { data: emp } = await supabase
    .from("employees")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const companyId = (emp as { company_id?: string } | null)?.company_id;
  if (!companyId) redirect("/my");

  const { data: docs } = await supabase
    .from("company_documents")
    .select("id, name, file_path, document_type, ai_summary, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          就業規則管理
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          PDFの登録・AI学習・削除は経営権限（オーナー・取締役）のみ行えます。全社員のAI相談に反映されます。
        </p>
      </div>
      <DocumentsAdminClient initialDocuments={docs ?? []} />
    </div>
  );
}
