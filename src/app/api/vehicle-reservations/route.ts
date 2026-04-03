import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date パラメータが必要です" }, { status: 400 });

    // date は "YYYY-MM-DD" (JST) — その日の 00:00〜翌日00:00 を取得
    const dayStart = `${date}T00:00:00+09:00`;
    const dayEnd = `${date}T23:59:59+09:00`;

    const { data, error } = await supabase
      .from("vehicle_reservations")
      .select("*, employees!vehicle_reservations_employee_id_fkey(name, auth_user_id)")
      .eq("company_id", profile.company_id)
      .gte("start_at", dayStart)
      .lte("start_at", dayEnd)
      .order("start_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const reservations = (data ?? []).map((r) => {
      const emp = r.employees as { name: string | null; auth_user_id: string } | null;
      return {
        id: r.id,
        vehicle_id: r.vehicle_id,
        employee_id: r.employee_id,
        employee_name: emp?.name ?? "不明",
        employee_auth_user_id: emp?.auth_user_id ?? null,
        start_at: r.start_at,
        end_at: r.end_at,
        purpose: r.purpose,
      };
    });

    return NextResponse.json({ reservations });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const body = (await req.json()) as {
      vehicle_id?: string;
      start_at?: string;
      end_at?: string;
      purpose?: string;
    };

    if (!body.vehicle_id || !body.start_at || !body.end_at) {
      return NextResponse.json({ error: "vehicle_id, start_at, end_at は必須です" }, { status: 400 });
    }

    const start = new Date(body.start_at);
    const end = new Date(body.end_at);
    if (end <= start) {
      return NextResponse.json({ error: "終了時刻は開始時刻より後にしてください" }, { status: 400 });
    }

    // 重複チェック
    const { data: conflicts } = await supabase
      .from("vehicle_reservations")
      .select("id")
      .eq("vehicle_id", body.vehicle_id)
      .lt("start_at", body.end_at)
      .gt("end_at", body.start_at);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "この時間帯は既に予約されています" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("vehicle_reservations")
      .insert({
        company_id: profile.company_id,
        vehicle_id: body.vehicle_id,
        employee_id: profile.id,
        start_at: body.start_at,
        end_at: body.end_at,
        purpose: body.purpose?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservation: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
