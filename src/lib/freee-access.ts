import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/freee-hr";

type TokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

/**
 * 会社の freee アクセストークンを取得。期限切れ間近なら refresh_token で更新。
 */
export async function getFreeeAccessToken(
  freeeCompanyId: string,
): Promise<string | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("freee_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("freee_company_id", freeeCompanyId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as TokenRow;
  const stillValid =
    row.expires_at != null &&
    new Date(row.expires_at).getTime() > Date.now() + 120_000;
  if (stillValid) return row.access_token;

  if (!row.refresh_token) return row.access_token;

  try {
    const next = await refreshAccessToken(row.refresh_token);
    const expiresAt = next.expires_in
      ? new Date(Date.now() + next.expires_in * 1000).toISOString()
      : null;
    await admin
      .from("freee_tokens")
      .update({
        access_token: next.access_token,
        refresh_token: next.refresh_token ?? row.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("freee_company_id", freeeCompanyId);
    return next.access_token;
  } catch {
    return row.access_token;
  }
}
