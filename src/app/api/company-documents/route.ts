import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/** 就業規則ドキュメント一覧取得（全社員可） */
export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const { data, error } = await supabase
      .from("company_documents")
      .select("id, name, file_path, document_type, ai_summary, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** ドキュメントアップロード（owner / director のみ） */
export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile || !["owner", "director"].includes(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    if (!file || !name?.trim()) {
      return NextResponse.json({ error: "file と name が必要です" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "pdf";
    const filePath = `${profile.company_id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("company-documents")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: doc, error: insertErr } = await supabase
      .from("company_documents")
      .insert({
        company_id: profile.company_id,
        name: name.trim(),
        file_path: filePath,
        document_type: "rules",
      })
      .select("id, name, file_path, document_type, created_at")
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** ドキュメント削除（owner / director のみ） */
export async function DELETE(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile || !["owner", "director"].includes(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

    const { data: doc, error: fetchErr } = await supabase
      .from("company_documents")
      .select("file_path, company_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !doc) return NextResponse.json({ error: "ドキュメントが見つかりません" }, { status: 404 });
    if ((doc as { company_id: string }).company_id !== profile.company_id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await supabase.storage
      .from("company-documents")
      .remove([(doc as { file_path: string }).file_path]);

    const { error: delErr } = await supabase
      .from("company_documents")
      .delete()
      .eq("id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
