/**
 * Supabase クライアント（サーバー / ブラウザ）
 *
 * - サーバー: Cookie 連携の SSR クライアント（RSC / Route Handler / Server Action）
 * - クライアント: ブラウザ用（createBrowserClient）
 */
import { createBrowserClient } from "@supabase/ssr";

/** サーバーサイド（@supabase/ssr + cookies） */
export { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

/** エイリアス（既存コード互換） */
export { createClient as createServerClient } from "@/lib/supabase/server";

export { createAdminClient } from "@/lib/supabase/admin";

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。",
    );
  }
  return createBrowserClient(url, anon);
}
