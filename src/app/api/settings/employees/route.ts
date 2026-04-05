import { getProfile, getSessionUser, isOwner } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwner(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("employees")
      .select(
        "id, name, role, department_id, is_sales_target, is_service_target, is_contract, is_part_time, line_user_id",
      )
      .eq("company_id", profile.company_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      department_id: r.department_id,
      is_sales_target: r.is_sales_target,
      is_service_target: r.is_service_target,
      is_contract: r.is_contract,
      is_part_time: r.is_part_time,
      line_user_id: r.line_user_id,
    }));

    return NextResponse.json({ employees: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const me = await getProfile(supabase, user.id);
    if (!me || !isOwner(me.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as {
      user_id?: string;
      is_sales_target?: boolean;
      is_service_target?: boolean;
      is_contract?: boolean;
      is_part_time?: boolean;
      department_id?: string | null;
    };

    const targetId = String(body.user_id ?? "");
    if (!targetId) {
      return NextResponse.json({ error: "user_id が必要です" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.is_sales_target === "boolean") patch.is_sales_target = body.is_sales_target;
    if (typeof body.is_service_target === "boolean") {
      patch.is_service_target = body.is_service_target;
    }
    if (typeof body.is_contract === "boolean") patch.is_contract = body.is_contract;
    if (typeof body.is_part_time === "boolean") patch.is_part_time = body.is_part_time;
    if (body.department_id !== undefined) patch.department_id = body.department_id;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: targetProf, error: tgtErr } = await admin
      .from("employees")
      .select("company_id")
      .eq("id", targetId)
      .maybeSingle();
    if (tgtErr || !targetProf) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
    }
    if ((targetProf as { company_id: string }).company_id !== me.company_id) {
      return NextResponse.json({ error: "他社のユーザーは更新できません" }, { status: 403 });
    }

    const { error } = await admin.from("employees").update(patch).eq("id", targetId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
