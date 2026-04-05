import { getProfile, getSessionUser } from "@/lib/api-auth";
import { normalizeCompanySettings } from "@/lib/company-settings";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { settings?: unknown };
    const newSettings = normalizeCompanySettings(body.settings);

    const { error } = await supabase
      .from("companies")
      .update({ settings: newSettings })
      .eq("id", profile.company_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, settings: newSettings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
