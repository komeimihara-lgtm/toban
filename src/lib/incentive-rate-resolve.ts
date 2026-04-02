import type { SupabaseClient } from "@supabase/supabase-js";

/** YYYY-MM */
export function yearMonth(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * 指定月の率。なければ同年の直近の前月…を辿る（最大12ヶ月）
 */
export async function resolveRateForEmployee(
  supabase: SupabaseClient,
  companyId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<{ rate: number; formula_type: string }> {
  let y = year;
  let mo = month;
  for (let i = 0; i < 14; i++) {
    const ym = yearMonth(y, mo);
    const { data } = await supabase
      .from("incentive_rates")
      .select("rate, formula_type")
      .eq("company_id", companyId)
      .eq("user_id", employeeId)
      .eq("year_month", ym)
      .maybeSingle();
    if (data && Number.isFinite(Number((data as { rate: number }).rate))) {
      return {
        rate: Number((data as { rate: number }).rate),
        formula_type: String((data as { formula_type?: string }).formula_type ?? "fixed_rate"),
      };
    }
    mo -= 1;
    if (mo < 1) {
      mo = 12;
      y -= 1;
    }
  }
  return { rate: 0, formula_type: "fixed_rate" };
}
