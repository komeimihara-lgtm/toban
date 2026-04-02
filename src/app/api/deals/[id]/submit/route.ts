import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { notifyApproversDealSubmitted } from "@/lib/deal-notify";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    if (isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "管理者はこのエンドポイントでは提出できません（案件編集で状態を変更してください）" }, { status: 400 });
    }

    const { id } = await ctx.params;
    const { data: row, error: fe } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (fe) {
      return NextResponse.json({ error: fe.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const d = row as {
      submit_status: string;
      appo_employee_id: string | null;
      closer_employee_id: string | null;
      salon_name: string;
      year: number;
      month: number;
    };

    const involved = d.appo_employee_id === user.id || d.closer_employee_id === user.id;
    if (!involved) {
      return NextResponse.json({ error: "自分が関与した案件のみ提出できます" }, { status: 403 });
    }

    if (!["draft", "rejected"].includes(d.submit_status)) {
      return NextResponse.json({ error: "下書きまたは差戻しの案件のみ提出できます" }, { status: 400 });
    }

    const { data: updated, error: upErr } = await supabase
      .from("deals")
      .update({
        submit_status: "submitted",
        submitted_by: user.id,
        reject_reason: null,
        approved_by: null,
      })
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await notifyApproversDealSubmitted({
      company_id: profile.company_id,
      salon_name: d.salon_name,
      year: d.year,
      month: d.month,
    });

    return NextResponse.json({ deal: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
