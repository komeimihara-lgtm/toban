import { getFreeeAccessToken } from "@/lib/freee-access";
import { syncPayslipAndDeemedForUser } from "@/lib/payslip-freee-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const freeeCompanyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!freeeCompanyId) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID が未設定です" },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("freee_employee_id")
    .eq("id", user.id)
    .maybeSingle();

  const freeeEmpId = profile?.freee_employee_id as number | null | undefined;
  if (freeeEmpId == null) {
    return Response.json({
      ok: false,
      needs_mapping: true,
      error:
        "profiles.freee_employee_id が未設定です（管理者が freee の従業員IDを登録してください）",
    });
  }

  const token = await getFreeeAccessToken(freeeCompanyId);
  if (!token) {
    return Response.json({
      ok: false,
      needs_oauth: true,
      error: "freee が未連携です。連携リンクから認証してください。",
    });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json(
      { ok: false, error: "サーバー設定（SERVICE_ROLE）が不足しています" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const year = Number(
    url.searchParams.get("year") ?? new Date().getFullYear(),
  );
  const month = Number(
    url.searchParams.get("month") ?? new Date().getMonth() + 1,
  );

  const companyIdNum = Number(freeeCompanyId);
  if (!Number.isFinite(companyIdNum)) {
    return Response.json(
      { ok: false, error: "FREEE_COMPANY_ID は数値の会社IDを指定してください" },
      { status: 503 },
    );
  }

  try {
    const out = await syncPayslipAndDeemedForUser(
      admin,
      token,
      companyIdNum,
      freeeCompanyId,
      user.id,
      freeeEmpId,
      year,
      month,
    );

    return Response.json({
      ok: true,
      year,
      month,
      payroll: out.payroll,
      deemed_ot: out.deemed_ot,
      paid_leave: out.paid_leave,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "freee api error";
    console.error("[api/payslip]", e);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
