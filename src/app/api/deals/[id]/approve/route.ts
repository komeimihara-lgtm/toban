import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { notifySubmitterDealDecision } from "@/lib/deal-notify";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }>};

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "承認権限がありません" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = (await req.json()) as { action?: string; reason?: string };
    const action = body.action;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action は approve または reject です" }, { status: 400 });
    }
    if (action === "reject" && !(body.reason && String(body.reason).trim())) {
      return NextResponse.json({ error: "差戻しには理由が必要です" }, { status: 400 });
    }

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

    const d = row as { submit_status: string; submitted_by: string | null; salon_name: string };
    if (d.submit_status !== "submitted") {
      return NextResponse.json({ error: "承認待ち（提出済み）の案件のみ処理できます" }, { status: 400 });
    }

    const reason = action === "reject" ? String(body.reason).trim() : null;

    const patch =
      action === "approve"
        ? {
            submit_status: "approved" as const,
            approved_by: user.id,
            reject_reason: null as string | null,
          }
        : {
            submit_status: "rejected" as const,
            approved_by: user.id,
            reject_reason: reason,
          };

    const { data: updated, error: upErr } = await supabase
      .from("deals")
      .update(patch)
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const logAction = action === "approve" ? "deal_approve" : "deal_reject";
    await supabase.from("approval_logs").insert({
      company_id: profile.company_id,
      target_type: "deal",
      target_id: id,
      action: logAction,
      actor_id: user.id,
      actor_name: profile.name,
      reason: reason,
    });

    await notifySubmitterDealDecision({
      company_id: profile.company_id,
      submitter_id: d.submitted_by,
      approved: action === "approve",
      salon_name: d.salon_name,
      reason,
    });

    return NextResponse.json({ deal: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
