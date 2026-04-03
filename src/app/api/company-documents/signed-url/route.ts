import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/** 署名付きURLを発行（閲覧用、60分有効） */
export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const body = (await req.json()) as { file_path?: string };
    const filePath = body.file_path?.trim();
    if (!filePath) return NextResponse.json({ error: "file_path が必要です" }, { status: 400 });

    // 自社のファイルであることを確認
    if (!filePath.startsWith(`${profile.company_id}/`)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(filePath, 3600); // 60分
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
