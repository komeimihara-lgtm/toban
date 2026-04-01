/** DB: public.profiles（auth.users.id と同一の id） */
export type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "owner" | "approver" | "staff";
  is_sales_target: boolean;
  is_service_target: boolean;
};

/** DB: public.incentive_rates */
export type IncentiveRateRow = {
  id: string;
  user_id: string;
  year_month: string;
  rate: number;
  formula_type: string;
};

/** DB: public.incentive_submissions */
export type IncentiveSubmissionRow = {
  id: string;
  user_id: string;
  year_month: string;
  sales_amount: number | null;
  rate_snapshot: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
};

export function isIncentiveEligible(p: Pick<ProfileRow, "is_sales_target" | "is_service_target">) {
  return p.is_sales_target || p.is_service_target;
}

export function isAdminRole(role: string) {
  return role === "owner" || role === "approver";
}
