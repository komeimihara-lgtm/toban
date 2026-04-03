/** DB: public.employees */
export type ProfileRow = {
  id: string;
  company_id: string;
  name: string | null;
  role: "owner" | "director" | "approver" | "sr" | "staff";
  is_sales_target: boolean;
  is_service_target: boolean;
};

/** DB: public.incentive_rates */
export type IncentiveRateRow = {
  id: string;
  company_id: string;
  user_id: string;
  year_month: string;
  rate: number;
  formula_type: string;
};

/** 案件インセンティブの役割（アポ／クローザーのみ） */
export type IncentiveDealRole = "appo" | "closer";

export const INCENTIVE_DEAL_ROLE_LABEL: Record<IncentiveDealRole, string> = {
  appo: "アポ",
  closer: "クローザー",
};

/** DB: public.incentive_submissions */
export type IncentiveSubmissionRow = {
  id: string;
  company_id: string;
  user_id: string;
  year_month: string;
  sales_amount: number | null;
  rate_snapshot: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  selling_price_tax_in?: number | null;
  actual_cost?: number | null;
  service_cost_deduction?: number | null;
  deal_role?: IncentiveDealRole | null;
  net_profit_ex_tax?: number | null;
  product_id?: string | null;
};

/** 純利益（税抜）= 販売価格(税込) ÷ 1.1 − 実質原価 − サービス（原価控除） */
export function computeNetProfitExTax(
  sellingPriceTaxIn: number,
  actualCost: number,
  serviceCostDeduction: number,
): number {
  const exTax = sellingPriceTaxIn / 1.1;
  return exTax - actualCost - serviceCostDeduction;
}

export function isIncentiveEligible(p: Pick<ProfileRow, "is_sales_target" | "is_service_target">) {
  return p.is_sales_target || p.is_service_target;
}

/** 管理者ロール（全管理メニュー表示対象） */
export function isAdminRole(role: string) {
  return role === "owner" || role === "director" || role === "approver" || role === "sr";
}

/** 給与・契約・退職リスク閲覧可（owner / director / sr） */
export function isSalaryAllowed(role: string) {
  return role === "owner" || role === "director" || role === "sr";
}

/** 退職リスク閲覧可（owner / director / sr） */
export function isRetentionAllowed(role: string) {
  return role === "owner" || role === "director" || role === "sr";
}

/** 承認権限（owner / director / approver） */
export function isApprovalAllowed(role: string) {
  return role === "owner" || role === "director" || role === "approver";
}
