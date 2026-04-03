import { getFreeeAccessToken } from "@/lib/freee-access";
import { syncAllProfilesPayslipAndDeemed } from "@/lib/payslip-freee-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 直前の暦月（デフォルト: 給与・勤怠を同じ年月で一括同期） */
function defaultSyncYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
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
      { ok: false, error: "freee トークンなし（/api/freee/auth から連携）" },
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

  const url = new URL(request.url);
  const def = defaultSyncYearMonth();
  const year = Number(url.searchParams.get("year") ?? def.year);
  const month = Number(url.searchParams.get("month") ?? def.month);

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
