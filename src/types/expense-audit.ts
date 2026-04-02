export type ExpenseAuditInput = {
  id?: string;
  submitter_id?: string;
  company_id?: string;
  type?: string;
  category: string;
  amount: number;
  paid_date: string;
  vendor: string;
  purpose: string;
  attendees?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  receipt_url?: string | null;
  ride_hour_local?: number | null;
  created_at?: string | null;
  is_sales_target?: boolean;
  activity_report_id?: string | null;
  activity_visit_count?: number | null;
  activity_meeting_count?: number | null;
  activity_area?: string | null;
  activity_client_names?: string | null;
};

export type ExpenseAuditVerdict = "approve" | "review" | "reject";

export type ExpenseAuditIssueSeverity = "info" | "warning" | "error";

export type ExpenseAuditIssue = {
  type: string;
  severity: ExpenseAuditIssueSeverity;
  message: string;
  saving_amount?: number;
};

export type ExpenseAuditResult = {
  verdict: ExpenseAuditVerdict;
  score: number;
  issues: ExpenseAuditIssue[];
  summary: string;
  suggestions: string[];
};
