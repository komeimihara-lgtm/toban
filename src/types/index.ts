/**
 * HR ドメイン型（マルチテナント: company_id は profiles / 各テーブルでスコープ）
 */
export type EmployeeRole = "owner" | "approver" | "staff";

export type CompanyPlan = "free" | "starter" | "pro";

/** 通知チャネル（companies.settings.notification.channels） */
export type NotificationChannel = "line" | "email";

export type ApprovalStepConfig = {
  order: number;
  approver_role: EmployeeRole;
  label: string;
};

export type CompanySettings = {
  approval: {
    /** one_step: steps[0] のみ使用、two_step: 2 段階想定（将来 N 段も可） */
    flow: "one_step" | "two_step";
    steps: ApprovalStepConfig[];
  };
  notification: {
    channels: NotificationChannel[];
  };
  incentive: {
    /** true のときインセンティブ対象部門は departments.incentive_enabled に従う */
    use_department_incentive_flag: boolean;
    notes?: string;
  };
};

export type Company = {
  id: string;
  name: string;
  plan: CompanyPlan;
  settings: CompanySettings;
  created_at: string;
};

/** DB: expense_categories.label を主に使用（会社ごと可変） */
export type ExpenseCategoryRow = {
  id: string;
  company_id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

/** 経費カテゴリは会社設定により可変（表示・検証は DB の label / code を使用） */
export type ExpenseCategory = string;

export type Employee = {
  id: string;
  company_id: string;
  name: string;
  department_id: string | null;
  role: EmployeeRole;
  is_sales_target: boolean;
  is_service_target: boolean;
  is_contract: boolean;
  is_part_time: boolean;
  email: string | null;
  line_user_id: string | null;
  is_active: boolean;
};

export type ExpenseType = "expense" | "travel" | "advance" | "advance_settle";

/** attendance_punches.punch_type */
export type AttendancePunchType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end";

export type ExpenseStatus =
  | "draft"
  | "step1_pending"
  | "step2_pending"
  | "approved"
  | "rejected";

export type Expense = {
  id: string;
  company_id: string;
  type: ExpenseType;
  status: ExpenseStatus;
  submitter_id: string;
  submitter_name: string | null;
  department_id: string | null;
  category: string;
  amount: number;
  paid_date: string;
  vendor: string;
  purpose: string;
  receipt_url: string | null;
  rejection_reason: string | null;
  step1_approved_by: string | null;
  step1_approved_at: string | null;
  step2_approved_by: string | null;
  step2_approved_at: string | null;
};

export type IncentiveConfigStatus =
  | "draft"
  | "submitted"
  | "step1_approved"
  | "final_approved"
  | "paid";

export type IncentiveConfig = {
  id: string;
  company_id: string;
  year: number;
  month: number;
  department_id: string;
  employee_id: string;
  sales_amount: number;
  rate: number;
  incentive_amount: number;
  status: IncentiveConfigStatus;
};

export type IncentiveRate = {
  id: string;
  company_id: string;
  year: number;
  month: number;
  employee_id: string;
  rate: number;
};

export type Department = {
  id: string;
  company_id: string;
  name: string;
};

export * from "./incentive";
