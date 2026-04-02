import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** 月次承認済みインセンティブの freee 連携（キュー投入） */
export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { year?: number; month?: number };
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("notification_queue").insert({
      company_id: profile.company_id,
      type: "freee_deal_incentive_sync",
      recipient_line_id: null,
      message: JSON.stringify({
        year,
        month,
        note: "freee 人事労務 API 連携はバッチで処理",
      }),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
