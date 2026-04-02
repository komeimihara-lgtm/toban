import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart 形式で送信してください" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file が必要です" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "8MB 以下のファイルにしてください" }, { status: 400 });
  }

  const taskRaw = formData.get("task_id");
  const taskId =
    taskRaw != null && String(taskRaw).trim() ? String(taskRaw).trim() : null;
  const docTypeRaw = formData.get("document_type");
  const documentType =
    docTypeRaw != null && String(docTypeRaw).trim()
      ? String(docTypeRaw).trim()
      : null;

  const safeName = file.name.replace(/[^\w.\u3000-\u30ff\u4e00-\u9faf\-]/g, "_");
  const path = `${user.id}/${crypto.randomUUID()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("onboarding-docs")
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("onboarding_documents").insert({
    company_id: profile.company_id,
    employee_id: user.id,
    task_id: taskId,
    document_type: documentType,
    file_url: path,
    file_name: file.name,
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
