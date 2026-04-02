import type { WorkRecordSummary } from "@/lib/freee-hr";

export type DeemedOtConfig = {
  allotted_hours: number;
  monthly_amount: number;
  alert_pct: number;
};

export type DeemedOtResult = {
  allotted_hours: number;
  actual_hours: number;
  late_night_hours: number;
  holiday_hours: number;
  excess_hours: number;
  remaining_hours: number;
  consumption_pct: number;
  status: "ok" | "warn" | "over";
  monthly_amount: number;
  excess_pay: number;
  hourly_rate: number;
};

const minutesToHoursDecimal = (minutes: number): number =>
  Math.round((minutes / 60) * 10) / 10;

export function calcDeemedOt(
  summary: WorkRecordSummary,
  config: DeemedOtConfig,
  baseHourlyRate?: number,
): DeemedOtResult {
  const actual = minutesToHoursDecimal(summary.overtime_work_time);
  const lateNight = minutesToHoursDecimal(summary.late_night_work_time);
  const holiday = minutesToHoursDecimal(summary.holiday_work_time);

  const pct = Math.round((actual / config.allotted_hours) * 100);
  const excess =
    Math.max(0, Math.round((actual - config.allotted_hours) * 10) / 10);
  const remaining = Math.max(
    0,
    Math.round((config.allotted_hours - actual) * 10) / 10,
  );

  const hourlyRate =
    baseHourlyRate ??
    Math.round(config.monthly_amount / config.allotted_hours);

  const excessPay =
    excess > 0 ? Math.round(excess * hourlyRate * 1.25) : 0;

  const status: DeemedOtResult["status"] =
    excess > 0 ? "over" : pct >= config.alert_pct ? "warn" : "ok";

  return {
    allotted_hours: config.allotted_hours,
    actual_hours: actual,
    late_night_hours: lateNight,
    holiday_hours: holiday,
    excess_hours: excess,
    remaining_hours: remaining,
    consumption_pct: Math.min(pct, 130),
    status,
    monthly_amount: config.monthly_amount,
    excess_pay: excessPay,
    hourly_rate: hourlyRate,
  };
}
