import {
  getProfile,
  getSessionUser,
  isOwnerOrApprover,
} from "@/lib/api-auth";
import { addOneCalendarDayJst } from "@/lib/jst-day-range";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** employees.id（employee_record_id）を指定。最終出勤日の翌日を無効化予定日に設定 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const employeeRecordId = (await ctx.params).id;
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  if (!isOwnerOrApprover(profile.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "サーバー設定エラー" }, { status: 503 });
  }

  const { data: emp, error: fe } = await admin
    .from("employees")
    .select("id, company_id, last_working_date, offboarding_status")
    .eq("id", employeeRecordId)
    .single();

  if (fe || !emp) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }

  const er = emp as {
    id: string;
    company_id: string;
    last_working_date: string | null;
    offboarding_status: string;
  };

  if (er.company_id !== profile.company_id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  if (er.offboarding_status !== "offboarding") {
    return NextResponse.json(
      { error: "退社手続き中の従業員のみスケジュールできます" },
      { status: 400 },
    );
  }

  if (!er.last_working_date) {
    return NextResponse.json(
      { error: "最終出勤日が未設定です" },
      { status: 400 },
    );
  }

  const scheduled = addOneCalendarDayJst(er.last_working_date);

  const { error: upE } = await admin
    .from("employees")
    .update({ scheduled_auth_deactivation_date: scheduled })
    .eq("id", er.id);

  if (upE) {
    return NextResponse.json({ error: upE.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scheduled_auth_deactivation_date: scheduled });
}
