import type { SupabaseClient } from "@supabase/supabase-js";

const ONBOARDING_WINDOW_DAYS = 30;

/**
 * 入社手続きリンク表示:
 * - employees.created_at から30日以内
 * - かつ onboarding_tasks に未完了が1件でもある（タスク0件は「未完了あり」とみなす）
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
  if (elapsedDays > ONBOARDING_WINDOW_DAYS) {
    return false;
  }

  const employeeId = (emp as { id: string }).id;

  const { data: tasks, error: tasksErr } = await supabase
    .from("onboarding_tasks")
    .select("completed")
    .eq("employee_id", employeeId);

  if (tasksErr) {
    return true;
  }

  if (!tasks?.length) {
    return true;
  }

  const allCompleted = tasks.every(
    (t: { completed?: boolean | null }) => t.completed === true,
  );
  return !allCompleted;
}
