import {
  getProfile,
  getSessionUser,
  isApprover,
  isOwner,
} from "@/lib/api-auth";
import {
  normalizeCompanySettings,
  usesLineChannel,
} from "@/lib/company-settings";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    const body = (await req.json()) as { action?: string };
    const action = body.action;
    if (action !== "step1" && action !== "step2") {
      return NextResponse.json({ error: "action は step1 または step2" }, { status: 400 });
    }
    if (action === "step1" && !isApprover(profile.role)) {
      return NextResponse.json({ error: "第1承認の権限がありません" }, { status: 403 });
    }
    if (action === "step2" && !isOwner(profile.role)) {
      return NextResponse.json({ error: "最終承認の権限がありません" }, { status: 403 });
    }

    const { data: row, error: fe } = await supabase
      .from("incentive_configs")
      .select("*")
      .eq("id", id)
      .single();
    if (fe || !row) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    const cfg = row as { id: string; status: string; employee_name: string | null };
    const now = new Date().toISOString();

    if (action === "step1") {
      if (cfg.status !== "submitted") {
        return NextResponse.json({ error: "提出済みの申請のみ第1承認できます" }, { status: 400 });
      }
      const { error: up } = await supabase
        .from("incentive_configs")
        .update({ status: "step1_approved", updated_at: now })
        .eq("id", id);
      if (up) return NextResponse.json({ error: up.message }, { status: 500 });

      const { error: log1 } = await supabase.from("approval_logs").insert({
        company_id: profile.company_id,
        target_type: "incentive",
        target_id: id,
        action: "step1_approve",
        actor_id: user.id,
        actor_name: profile.full_name,
      });
      if (log1) {
        return NextResponse.json({ error: log1.message }, { status: 500 });
      }

      try {
        const admin = createAdminClient();
        const { data: co } = await admin
          .from("companies")
          .select("settings")
          .eq("id", profile.company_id)
          .maybeSingle();
        const settings = normalizeCompanySettings(
          (co as { settings?: unknown } | null)?.settings,
        );
        const { data: owners } = await admin
          .from("profiles")
          .select("line_user_id")
          .eq("role", "owner")
          .eq("company_id", profile.company_id);
        const msg = `インセンティブ第1承認済・最終承認待ち: ${cfg.employee_name ?? "対象者"}`;
        for (const o of owners ?? []) {
          const line = (o as { line_user_id: string | null }).line_user_id;
          if (usesLineChannel(settings) && line) {
            await enqueueNotification({
              company_id: profile.company_id,
              type: "incentive_step2_request",
              recipient_line_id: line,
              message: msg,
            });
          }
        }
      } catch {
        /* ignore */
      }

      return NextResponse.json({ ok: true });
    }

    if (cfg.status !== "step1_approved") {
      return NextResponse.json({ error: "第1承認済みのもののみ最終承認できます" }, { status: 400 });
    }
    const { error: up2 } = await supabase
      .from("incentive_configs")
      .update({ status: "final_approved", updated_at: now })
      .eq("id", id);
    if (up2) return NextResponse.json({ error: up2.message }, { status: 500 });

    const { error: log2 } = await supabase.from("approval_logs").insert({
      company_id: profile.company_id,
      target_type: "incentive",
      target_id: id,
      action: "step2_approve",
      actor_id: user.id,
      actor_name: profile.full_name,
    });
    if (log2) {
      return NextResponse.json({ error: log2.message }, { status: 500 });
    }

    try {
      const admin = createAdminClient();
      await admin.from("notification_queue").insert({
        company_id: profile.company_id,
        type: "freee_incentive_sync",
        recipient_line_id: null,
        message: JSON.stringify({
          incentive_config_id: id,
          note: "freee 人事労務 API 連携はバッチで処理",
        }),
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
