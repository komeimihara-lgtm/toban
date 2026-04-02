import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getNextGrantDate,
  nextMilestoneGrantDelta,
  ymdJst,
} from "@/lib/paid-leave";

export type PersonalHrData = {
  contract: Record<string, unknown> | null;
  paidLeaveRemaining: number;
  nextGrantDate: string | null;
  nextGrantDelta: number | null;
  commuteActiveCount: number;
  yearsEmployed: number | null;
  onProbation: boolean;
};

function yearsBetweenJst(startYmd: string, end = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return null;
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const endYmd = ymdJst(end);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  let y = ey - sy;
  if (em < sm || (em === sm && ed < sd)) y -= 1;
  return Math.max(0, y);
}

export async function fetchPersonalHrSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonalHrData> {
  const today = ymdJst(new Date());

  const { data: contractRaw } = await supabase
    .from("employment_contracts")
    .select("*")
    .eq("employee_id", userId)
    .maybeSingle();

  const contract = (contractRaw ?? null) as Record<string, unknown> | null;

  const startRaw =
    (contract?.start_date as string | undefined) ??
    (contract?.hire_date as string | undefined);
  const startDate =
    startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
      ? new Date(`${startRaw}T12:00:00+09:00`)
      : null;

  const { data: grants } = await supabase
    .from("paid_leave_grants")
    .select("days_remaining, expires_at")
    .eq("employee_id", userId);

  let paidLeaveRemaining = 0;
  for (const g of grants ?? []) {
    const row = g as { days_remaining: number; expires_at: string | null };
    if (row.expires_at && row.expires_at < today) continue;
    paidLeaveRemaining += Number(row.days_remaining ?? 0);
  }

  const next = startDate ? getNextGrantDate(startDate) : null;
  const nextDeltaInfo = startDate ? nextMilestoneGrantDelta(startDate) : null;

  const { count: commuteActiveCount } = await supabase
    .from("commute_expenses")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", userId)
    .eq("is_active", true);

  const trialEnd = (contract?.trial_end_date as string | undefined) ?? null;
  const onProbation = Boolean(
    trialEnd && /^\d{4}-\d{2}-\d{2}$/.test(trialEnd) && trialEnd >= today,
  );

  return {
    contract,
    paidLeaveRemaining: Math.round(paidLeaveRemaining * 100) / 100,
    nextGrantDate: next ? ymdJst(next) : null,
    nextGrantDelta: nextDeltaInfo?.delta ?? null,
    commuteActiveCount: commuteActiveCount ?? 0,
    yearsEmployed: startRaw ? yearsBetweenJst(startRaw) : null,
    onProbation,
  };
}
