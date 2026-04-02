import type { SupabaseClient } from "@supabase/supabase-js";

/** 入社30日以内、またはオンボタスク未完了のときだけサイドバーに表示 */
export async function shouldShowOnboardingNav(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: emp } = await supabase
    .from("employees")
    .select("id, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!emp) return false;

  const { data: contract } = await supabase
    .from("employment_contracts")
    .select("start_date, hire_date")
    .eq("employee_id", userId)
    .maybeSingle();

  const c = contract as { start_date?: string | null; hire_date?: string | null } | null;
  const ymd =
    (c?.start_date && String(c.start_date).slice(0, 10)) ||
    (c?.hire_date && String(c.hire_date).slice(0, 10)) ||
    String((emp as { created_at: string }).created_at).slice(0, 10);

  const anchor = new Date(`${ymd}T12:00:00+09:00`);
  if (!Number.isFinite(anchor.getTime())) return false;
  const daysSince = (Date.now() - anchor.getTime()) / 86_400_000;
  const within30 = daysSince <= 30;

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("status")
    .eq("employee_id", (emp as { id: string }).id);

  const hasIncomplete = (tasks ?? []).some((t) => {
    const st = (t as { status: string }).status;
    return st !== "completed" && st !== "skipped";
  });

  return within30 || hasIncomplete;
}
