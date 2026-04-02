import { getProfile, getSessionUser } from "@/lib/api-auth";
import { fetchCompanyContext } from "@/lib/company-context";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }
    const ctx = await fetchCompanyContext(supabase, profile.company_id);
    if (!ctx) {
      return NextResponse.json({ error: "会社情報の取得に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({
      ...ctx,
      viewer: { is_sales_target: profile.is_sales_target },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
