import { getProfile, getSessionUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** 自社の部署一覧（インセンティブ対象フラグ含む）。owner / approver が参照可。 */
export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile || !["owner", "approver"].includes(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("departments")
      .select("id, name, incentive_enabled, incentive_formula_type")
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

/** incentive_enabled の更新。owner のみ。 */
export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const me = await getProfile(supabase, user.id);
    if (!me || me.role !== "owner") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as {
      id?: string;
      incentive_enabled?: boolean;
    };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }
    if (typeof body.incentive_enabled !== "boolean") {
      return NextResponse.json({ error: "incentive_enabled が必要です" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error: readErr } = await admin
      .from("departments")
      .select("company_id")
      .eq("id", id)
      .maybeSingle();
    if (readErr || !row) {
      return NextResponse.json({ error: "部署が見つかりません" }, { status: 404 });
    }
    if ((row as { company_id: string }).company_id !== me.company_id) {
      return NextResponse.json({ error: "他社の部署は更新できません" }, { status: 403 });
    }

    const { error } = await admin
      .from("departments")
      .update({ incentive_enabled: body.incentive_enabled })
      .eq("id", id)
      .eq("company_id", me.company_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
