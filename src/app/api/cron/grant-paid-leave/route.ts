import { normalizeCompanySettings, usesLineChannel } from "@/lib/company-settings";
import { checkAndGrantPaidLeave } from "@/lib/paid-leave";
import { enqueueNotification } from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authorized =
    process.env.NODE_ENV !== "production" ||
    (secret && auth === `Bearer ${secret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client unavailable" },
      { status: 503 },
    );
  }

  const { data: contracts, error } = await admin
    .from("employment_contracts")
    .select("employee_id, company_id, start_date, hire_date, is_active")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let checked = 0;
  let grantsInserted = 0;
  const notifications: { line: number } = { line: 0 };

  for (const row of contracts ?? []) {
    const r = row as {
      employee_id: string;
      company_id: string;
      start_date: string | null;
      hire_date: string | null;
      is_active: boolean | null;
    };
    const startYmd = r.start_date ?? r.hire_date;
    if (!startYmd) continue;
    checked += 1;

    const result = await checkAndGrantPaidLeave(admin, {
      employeeId: r.employee_id,
      companyId: r.company_id,
      startDateYmd: startYmd,
    });
    grantsInserted += result.granted;

    for (const n of result.notifications) {
      const { data: co } = await admin
        .from("companies")
        .select("settings")
        .eq("id", n.company_id)
        .maybeSingle();
      const settings = normalizeCompanySettings(
        (co as { settings?: unknown } | null)?.settings,
      );
      if (usesLineChannel(settings) && n.line_user_id) {
        await enqueueNotification({
          company_id: n.company_id,
          type: "paid_leave_granted",
          recipient_line_id: n.line_user_id,
          message: `【有給付与】${n.full_name ?? "従業員"}さん\n${n.grant_date} 付与: ${n.days_granted} 日（自動計算）`,
        });
        notifications.line += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    contractsChecked: checked,
    grantsInserted,
    lineNotifications: notifications.line,
  });
}
