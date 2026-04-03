import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseAuditInput } from "@/types/expense-audit";

/**
 * activity_report_id が未設定でも、同日の activity_reports があれば input に合算して審査に効かせる。
 * （経費と日報が別途登録されているケース）
 */
export async function enrichInputFromLinkedActivityReports(
  supabase: SupabaseClient,
  input: ExpenseAuditInput,
): Promise<void> {
  if (!input.is_sales_target || !input.submitter_id || !input.company_id || !input.paid_date) {
    return;
  }
  if (input.activity_report_id) {
    return;
  }
  const d = input.paid_date.slice(0, 10);
  const { data: rows } = await supabase
    .from("activity_reports")
    .select("visit_count, meeting_count, area, client_names")
    .eq("company_id", input.company_id)
    .eq("employee_id", input.submitter_id)
    .eq("report_date", d);

  if (!rows?.length) return;

  let v = 0;
  let m = 0;
  const areas: string[] = [];
  const clients: string[] = [];
  for (const r of rows) {
    const row = r as {
      visit_count?: number;
      meeting_count?: number;
      area?: string | null;
      client_names?: string | null;
    };
    v += Number(row.visit_count ?? 0);
    m += Number(row.meeting_count ?? 0);
    if (row.area?.trim()) areas.push(row.area.trim());
    if (row.client_names?.trim()) clients.push(row.client_names.trim());
  }

  input.activity_visit_count = Math.max(input.activity_visit_count ?? 0, v);
  input.activity_meeting_count = Math.max(input.activity_meeting_count ?? 0, m);
  if (!(input.activity_area?.trim()) && areas.length) {
    input.activity_area = [...new Set(areas)].join("・");
  }
  if (!(input.activity_client_names?.trim()) && clients.length) {
    input.activity_client_names = [...new Set(clients)].join("、");
  }
}
