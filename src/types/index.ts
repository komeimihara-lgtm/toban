/**
 * TOBAN ドメイン型（マルチテナント: company_id は profiles / 各テーブルでスコープ）
 */

/** DB 行の共通: テナント分離キー */
export type TenantScoped = {
  company_id: string;
};

export type EmployeeRole = "owner" | "staff";

export type CompanyPlan = "free" | "starter" | "pro";

/** 通知チャネル（companies.settings.notification.channels） */
export type NotificationChannel = "line" | "email";

export type CompanySettings = {
  notification: {
    channels: NotificationChannel[];
  };
};

export type Company = {
  id: string;
  name: string;
  plan: CompanyPlan;
  settings: CompanySettings;
  created_at: string;
};

export type Employee = {
  id: string;
  company_id: string;
  name: string;
  department_id: string | null;
  role: EmployeeRole;
  email: string | null;
  line_user_id: string | null;
  is_active: boolean;
};

export type Department = {
  id: string;
  company_id: string;
  name: string;
};

/** attendance_punches.punch_type */
export type AttendancePunchType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end";

/** 勤怠打刻 */
export type AttendancePunch = TenantScoped & {
  id: string;
  user_id: string;
  punch_type: AttendancePunchType;
  punched_at: string;
  source?: string | null;
};

export type AppNotification = TenantScoped & {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};
