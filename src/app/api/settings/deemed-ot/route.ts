import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";

export const dynamic = "force-dynamic";

/** GET: みなし残業設定一覧（管理者のみ） */
export async function GET() {
  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json({ ok: false, error: "FREEE_COMPANY_ID 未設定" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role ?? "")) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ ok: false, error: "service role 未設定" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("deemed_ot_settings")
    .select("*")
    .eq("freee_company_id", freeeCompanyId)
    .order("app_user_id", { ascending: true, nullsFirst: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, settings: data ?? [] });
}

type PostBody = {
  app_user_id?: string | null;
  allotted_hours: number;
  monthly_amount: number;
  alert_pct?: number;
};

/** POST: みなし残業設定の保存（管理者のみ） */
export async function POST(request: Request) {
  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json({ ok: false, error: "FREEE_COMPANY_ID 未設定" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role ?? "")) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const allotted = Number(body.allotted_hours);
  const monthly = Number(body.monthly_amount);
  const alertPct = Number(body.alert_pct ?? 80);

  if (!Number.isFinite(allotted) || allotted < 1 || allotted > 99) {
    return Response.json(
      { ok: false, error: "みなし残業時間は1〜99時間で設定してください" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(monthly) || monthly < 0) {
    return Response.json(
      { ok: false, error: "固定残業代は0円以上で設定してください" },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ ok: false, error: "service role 未設定" }, { status: 503 });
  }

  const appUserId =
    body.app_user_id === undefined || body.app_user_id === ""
      ? null
      : body.app_user_id;

  const row = {
    freee_company_id: freeeCompanyId,
    app_user_id: appUserId,
    allotted_hours: allotted,
    monthly_amount: monthly,
    alert_pct: alertPct,
    updated_at: new Date().toISOString(),
  };

  const base = admin
    .from("deemed_ot_settings")
    .select("id")
    .eq("freee_company_id", freeeCompanyId);
  const { data: existing } = appUserId
    ? await base.eq("app_user_id", appUserId).maybeSingle()
    : await base.is("app_user_id", null).maybeSingle();

  const { error } = existing
    ? await admin
        .from("deemed_ot_settings")
        .update(row)
        .eq("id", (existing as { id: string }).id)
    : await admin.from("deemed_ot_settings").insert(row);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
