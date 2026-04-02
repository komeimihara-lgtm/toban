const FREEE_ACCOUNTS = "https://accounts.secure.freee.co.jp";
/** 人事労務 API v1 ベース（会計 API とは別 host path） */
const FREEE_HR_API = "https://api.freee.co.jp/hr/api/v1";

export const FREEE_HR_SCOPES =
  "hr.employee_payroll_statements:read hr.work_records:read";

export type WorkRecordSummary = {
  year: number;
  month: number;
  total_work_time: number;
  overtime_work_time: number;
  late_night_work_time: number;
  holiday_work_time: number;
  paid_holiday_used_days: number;
  paid_holiday_remaining_days: number;
};

export type PayrollStatement = {
  id: number;
  employee_id: number;
  year: number;
  month: number;
  pay_date: string;
  base_salary: number;
  commuting_allowance: number;
  fixed_overtime_pay: number;
  excess_overtime_pay: number;
  total_payment_amount: number;
  health_insurance_amount: number;
  welfare_pension_amount: number;
  employment_insurance_amount: number;
  income_tax_amount: number;
  inhabitant_tax_amount: number;
  total_deduction_amount: number;
  net_payment_amount: number;
};

function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  } as const;
}

export async function fetchWorkSummary(
  token: string,
  companyId: number,
  employeeId: number,
  year: number,
  month: number,
): Promise<WorkRecordSummary> {
  const url = `${FREEE_HR_API}/employees/${employeeId}/work_record_summaries/${year}/${month}?company_id=${companyId}`;
  const res = await fetch(url, { headers: authHeader(token), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee work_record_summaries: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    year,
    month,
    total_work_time: Number(data.total_work_time ?? 0),
    overtime_work_time: Number(data.overtime_work_time ?? 0),
    late_night_work_time: Number(data.late_night_work_time ?? 0),
    holiday_work_time: Number(data.holiday_work_time ?? 0),
    paid_holiday_used_days: Number(data.paid_holiday_used_days ?? 0),
    paid_holiday_remaining_days: Number(
      data.paid_holiday_remaining_days ?? 0,
    ),
  };
}

function mapPayrollRow(raw: Record<string, unknown>): PayrollStatement {
  return {
    id: Number(raw.id ?? 0),
    employee_id: Number(raw.employee_id ?? 0),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    pay_date: String(raw.pay_date ?? ""),
    base_salary: Number(raw.base_salary ?? 0),
    commuting_allowance: Number(raw.commuting_allowance ?? 0),
    fixed_overtime_pay: Number(raw.fixed_overtime_pay ?? 0),
    excess_overtime_pay: Number(raw.excess_overtime_pay ?? 0),
    total_payment_amount: Number(raw.total_payment_amount ?? 0),
    health_insurance_amount: Number(raw.health_insurance_amount ?? 0),
    welfare_pension_amount: Number(raw.welfare_pension_amount ?? 0),
    employment_insurance_amount: Number(
      raw.employment_insurance_amount ?? 0,
    ),
    income_tax_amount: Number(raw.income_tax_amount ?? 0),
    inhabitant_tax_amount: Number(raw.inhabitant_tax_amount ?? 0),
    total_deduction_amount: Number(raw.total_deduction_amount ?? 0),
    net_payment_amount: Number(raw.net_payment_amount ?? 0),
  };
}

export async function fetchPayroll(
  token: string,
  companyId: number,
  employeeId: number,
  year: number,
  month: number,
): Promise<PayrollStatement | null> {
  const params = new URLSearchParams({
    company_id: String(companyId),
    employee_id: String(employeeId),
    year: String(year),
    month: String(month),
  });
  const url = `${FREEE_HR_API}/salaries/employee_payroll_statements?${params}`;
  const res = await fetch(url, { headers: authHeader(token), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee payroll: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    employee_payroll_statements?: Record<string, unknown>[];
  };
  const row = data.employee_payroll_statements?.[0];
  return row ? mapPayrollRow(row) : null;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / FREEE_REDIRECT_URI が必要です");
  }
  const res = await fetch(`${FREEE_ACCOUNTS}/public_api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee token: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("FREEE_CLIENT_ID / FREEE_CLIENT_SECRET が必要です");
  }
  const res = await fetch(`${FREEE_ACCOUNTS}/public_api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee refresh: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}
