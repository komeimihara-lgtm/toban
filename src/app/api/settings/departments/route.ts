import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/** 自社の部署一覧。owner が参照可。 */
export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .order("name");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ departments: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
