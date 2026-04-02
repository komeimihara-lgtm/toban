import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * 初回管理者アカウント作成（本番では ALLOW_AUTH_SETUP を外すかルートを削除すること）
 * POST { email, password, employee_id } — employee_id は public.employees.id (uuid)
 * 事前に employees.user_id = profiles.id が紐付いていること。
 */
export async function POST(req: Request) {
  if (process.env.ALLOW_AUTH_SETUP !== "true") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { email?: string; password?: string; employee_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const employeeId = String(body.employee_id ?? "").trim();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "email と password（8文字以上）が必要です" },
      { status: 400 },
    );
  }
  if (!employeeId) {
    return NextResponse.json({ error: "employee_id が必要です" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, user_id, company_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (empErr || !emp) {
      return NextResponse.json(
        { error: "employees が見つかりません" },
        { status: 404 },
      );
    }

    const profileId = (emp as { user_id: string }).user_id;

    const { data: existing } = await admin.auth.admin.getUserById(profileId);
    if (existing?.user) {
      return NextResponse.json(
        { error: "このプロフィールには既に Auth ユーザーがあります" },
        { status: 409 },
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      id: profileId,
    });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message ?? "ユーザー作成に失敗しました" },
        { status: 500 },
      );
    }

    const authUid = created.user.id;

    await admin
      .from("employees")
      .update({ auth_user_id: authUid })
      .eq("id", employeeId);

    return NextResponse.json({
      ok: true,
      user_id: authUid,
      message: "作成しました。ALLOW_AUTH_SETUP をオフにしてください。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
