import { getFreeeAccessToken } from "@/lib/freee-access";
import {
  syncAllProfilesPayslipAndDeemed,
} from "@/lib/payslip-freee-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";

export const dynamic = "force-dynamic";

function defaultSyncYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** 管理者のみ: 全員分の給与明細・勤怠・みなし残業を Supabase に同期（Cron と同じ処理） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role ?? "")) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID 未設定" },
      { status: 503 },
    );
  }

  const companyIdNum = Number(freeeCompanyId);
  if (!Number.isFinite(companyIdNum)) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID は数値の会社IDを指定してください" },
      { status: 503 },
    );
  }

  const token = await getFreeeAccessToken(freeeCompanyId);
  if (!token) {
    return Response.json(
      { ok: false, error: "freee 未連携", needs_oauth: true },
      { status: 503 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json(
      { ok: false, error: "SERVICE_ROLE 未設定" },
      { status: 503 },
    );
  }

  let body: { year?: number; month?: number } = {};
  try {
    body = (await request.json()) as { year?: number; month?: number };
  } catch {
    /* 空ボディ可 */
  }

  const def = defaultSyncYearMonth();
  const year = body.year ?? def.year;
  const month = body.month ?? def.month;

  let results;
  try {
    results = await syncAllProfilesPayslipAndDeemed(
      admin,
      token,
      companyIdNum,
      freeeCompanyId,
      year,
      month,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }

  return Response.json({
    ok: true,
    year,
    month,
    staff_count: results.length,
    results,
  });
}
