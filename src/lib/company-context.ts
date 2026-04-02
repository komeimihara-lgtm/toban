import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCompanySettings } from "@/lib/company-settings";
import type { Company, ExpenseCategoryRow } from "@/types/index";

export type CompanyContextPayload = {
  company: Company;
  expense_categories: Pick<
    ExpenseCategoryRow,
    "id" | "code" | "label" | "sort_order"
  >[];
};

/** セッション利用者のテナント（RLS で companies / expense_categories がスコープされる想定） */
export async function fetchCompanyContext(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyContextPayload | null> {
  const [{ data: companyRow, error: ce }, { data: cats, error: catE }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, plan, settings, created_at")
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("expense_categories")
        .select("id, code, label, sort_order")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

  if (ce || !companyRow || catE) return null;

  const cr = companyRow as {
    id: string;
    name: string;
    plan: string;
    settings: unknown;
    created_at: string;
  };

  const company: Company = {
    id: cr.id,
    name: cr.name,
    plan: cr.plan === "starter" || cr.plan === "pro" ? cr.plan : "free",
    settings: normalizeCompanySettings(cr.settings),
    created_at: cr.created_at,
  };

  return {
    company,
    expense_categories: (cats ?? []) as CompanyContextPayload["expense_categories"],
  };
}
