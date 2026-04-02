import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type AuthProfile = {
  id: string;
  company_id: string;
  role: string;
  full_name: string | null;
  line_user_id: string | null;
  department_id: string | null;
  is_sales_target: boolean;
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase };
  return { user, supabase };
}

export async function requireSession() {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }),
    };
  }
  return { ok: true as const, user, supabase };
}

export async function getProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, company_id, role, full_name, line_user_id, department_id, is_sales_target",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as AuthProfile;
  return {
    ...row,
    is_sales_target: Boolean(row.is_sales_target),
  };
}

export async function requireProfile() {
  const s = await requireSession();
  if (!s.ok) return s;
  const profile = await getProfile(s.supabase, s.user.id);
  if (!profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 }),
    };
  }
  return { ok: true as const, user: s.user, supabase: s.supabase, profile };
}

export function isOwner(role: string) {
  return role === "owner";
}

export function isApprover(role: string) {
  return role === "approver";
}

export function isOwnerOrApprover(role: string) {
  return role === "owner" || role === "approver";
}
