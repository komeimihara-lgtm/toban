import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    // 本人 or owner/director のみ削除可
    const { data: reservation } = await supabase
      .from("vehicle_reservations")
      .select("employee_id")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .single();

    if (!reservation) {
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    }

    const isOwner = reservation.employee_id === profile.id;
    if (!isOwner && !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "この予約を削除する権限がありません" }, { status: 403 });
    }

    const { error } = await supabase
      .from("vehicle_reservations")
      .delete()
      .eq("id", id)
      .eq("company_id", profile.company_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
