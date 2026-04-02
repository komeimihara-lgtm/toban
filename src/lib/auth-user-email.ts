import type { SupabaseClient } from "@supabase/supabase-js";

/** Auth 管理 API でユーザーのログイン用メールを取得（service_role のクライアントで呼ぶこと） */
export async function getAuthUserEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}
