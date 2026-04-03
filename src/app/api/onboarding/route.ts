import {
  getProfile,
  getSessionUser,
  isOwnerOrApprover,
} from "@/lib/api-auth";
import { ONBOARDING_TASK_SEEDS } from "@/lib/onboarding-task-seeds";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const url = new URL(req.url);
  const forUser = url.searchParams.get("for_user");
  let targetProfileId = user.id;

  if (forUser) {
    if (!isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    targetProfileId = forUser.trim();
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("user_id", targetProfileId)
    .maybeSingle();

  if (!emp) {
    return NextResponse.json({
      tasks: [],
      documents: [],
      employee_record_id: null,
      target_user_id: targetProfileId,
    });
  }

  const empId = (emp as { id: string }).id;

  const { data: tasks, error: te } = await supabase
    .from("onboarding_tasks")
    .select("*")
    .eq("employee_id", empId)
    .order("created_at", { ascending: true });

  if (te) {
    return NextResponse.json({ error: te.message }, { status: 500 });
  }

  const { data: docs, error: de } = await supabase
    .from("onboarding_documents")
    .select("*")
    .eq("employee_id", targetProfileId)
    .order("uploaded_at", { ascending: false });

  if (de) {
    return NextResponse.json({ error: de.message }, { status: 500 });
  }

  const documents = [];
  for (const d of docs ?? []) {
    const row = d as { file_url: string };
    const { data: signed } = await supabase.storage
      .from("onboarding-docs")
      .createSignedUrl(row.file_url, 3600);
    documents.push({
      ...row,
      signed_url: signed?.signedUrl ?? null,
    });
  }

  return NextResponse.json({
    tasks: tasks ?? [],
    documents,
    employee_record_id: empId,
    target_user_id: targetProfileId,
  });
}

export async function POST(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { user_id?: string };
  let targetUserId = user.id;
  if (body.user_id != null && String(body.user_id).trim()) {
    if (!isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    targetUserId = String(body.user_id).trim();
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "サーバー設定が不足しています" },
      { status: 503 },
    );
  }

  const { data: tp } = await admin
    .from("profiles")
    .select("company_id, is_sales_target, is_service_target")
    .eq("id", targetUserId)
    .maybeSingle();
  const tRow = tp as {
    company_id: string;
    is_sales_target: boolean;
    is_service_target: boolean;
  } | null;
  if (!tRow || tRow.company_id !== profile.company_id) {
    return NextResponse.json(
      { error: "対象ユーザーが見つかりません" },
      { status: 400 },
    );
  }

  const { data: ex } = await admin
    .from("employees")
    .select("id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  let empId: string;
  if (!ex) {
    const { data: ins, error: insE } = await admin
      .from("employees")
      .insert({
        user_id: targetUserId,
        company_id: profile.company_id,
        is_sales_target: tRow.is_sales_target,
        is_service_target: tRow.is_service_target,
      })
      .select("id")
      .single();
    if (insE || !ins) {
      return NextResponse.json({ error: insE?.message ?? "作成に失敗" }, { status: 500 });
    }
    empId = (ins as { id: string }).id;
  } else {
    empId = (ex as { id: string }).id;
  }

  const { count, error: cErr } = await admin
    .from("onboarding_tasks")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", empId);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const rows = ONBOARDING_TASK_SEEDS.map((s) => ({
    company_id: profile.company_id,
    employee_id: empId,
    task_type: s.task_type,
    title: s.title,
    description: s.description,
    status: "pending",
  }));

  const { error: bulkE } = await admin.from("onboarding_tasks").insert(rows);
  if (bulkE) {
    return NextResponse.json({ error: bulkE.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
