import type { SupabaseClient } from "@supabase/supabase-js";

const ONBOARDING_WINDOW_DAYS = 30;

/**
 * 入社手続きリンク表示:
 * - 入社（employees.created_at）から30日以内、または
 * - onboarding_tasks に completed 以外のタスクが1件でもある
 * 上記いずれかを満たすときのみ表示。それ以外は非表示。
 */
export async function shouldShowOnboardingLink(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (empErr || !emp) {
    return false;
  }

  const created = new Date(String((emp as { created_at: string }).created_at));
  if (Number.isNaN(created.getTime())) {
    return false;
  }

  const elapsedDays =
    (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  const within30 = elapsedDays <= ONBOARDING_WINDOW_DAYS;

  const employeeId = (emp as { id: string }).id;

  const { data: tasks, error: tasksErr } = await supabase
    .from("onboarding_tasks")
    .select("completed")
    .eq("employee_id", employeeId);

  if (tasksErr) {
    return within30;
  }

  const hasIncomplete =
    tasks?.some((t: { completed?: boolean | null }) => t.completed !== true) ??
    false;

  return within30 || hasIncomplete;
}
