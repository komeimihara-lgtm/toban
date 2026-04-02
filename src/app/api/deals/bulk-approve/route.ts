import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { notifySubmitterDealDecision } from "@/lib/deal-notify";
import { NextResponse } from "next/server";

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

    const body = (await req.json()) as { ids?: string[]; action?: string };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
    const action = body.action;
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids が必要です" }, { status: 400 });
    }
    if (action !== "approve") {
      return NextResponse.json({ error: "一括処理は action=approve のみ対応しています" }, { status: 400 });
    }

    const { data: rows, error: fe } = await supabase
      .from("deals")
      .select("id, submit_status, submitted_by, salon_name")
      .eq("company_id", profile.company_id)
      .in("id", ids);

    if (fe) {
      return NextResponse.json({ error: fe.message }, { status: 500 });
    }

    const toApprove = (rows ?? []).filter((r) => (r as { submit_status: string }).submit_status === "submitted");

    for (const r of toApprove) {
      const row = r as { id: string; submitted_by: string | null; salon_name: string };
      const { error: upErr } = await supabase
        .from("deals")
        .update({
          submit_status: "approved",
          approved_by: user.id,
          reject_reason: null,
        })
        .eq("id", row.id)
        .eq("company_id", profile.company_id)
        .eq("submit_status", "submitted");

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      await supabase.from("approval_logs").insert({
        company_id: profile.company_id,
        target_type: "deal",
        target_id: row.id,
        action: "deal_approve",
        actor_id: user.id,
        actor_name: profile.full_name,
      });

      await notifySubmitterDealDecision({
        company_id: profile.company_id,
        submitter_id: row.submitted_by,
        approved: true,
        salon_name: row.salon_name,
      });
    }

    return NextResponse.json({ ok: true, approved_count: toApprove.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
