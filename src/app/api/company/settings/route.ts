import { getProfile, getSessionUser } from "@/lib/api-auth";
import { mergeCompanySettingsPatch } from "@/lib/company-settings";
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
    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "settings オブジェクトが必要です" }, { status: 400 });
    }

    const { data: row, error: readErr } = await supabase
      .from("companies")
      .select("settings")
      .eq("id", profile.company_id)
      .single();
    if (readErr || !row) {
      return NextResponse.json({ error: readErr?.message ?? "会社が見つかりません" }, { status: 500 });
    }

    const merged = mergeCompanySettingsPatch(row.settings, body.settings);
    const { error: upErr } = await supabase
      .from("companies")
      .update({ settings: merged })
      .eq("id", profile.company_id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, settings: merged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
