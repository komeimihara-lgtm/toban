import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const employeeId = url.searchParams.get("employee_id");

    let q = supabase
      .from("check_sheets")
      .select("*")
      .eq("company_id", profile.company_id);

    if (year) q = q.eq("year", year);
    if (month) q = q.eq("month", month);
    if (employeeId && ["owner", "approver"].includes(profile.role)) {
      q = q.eq("employee_id", employeeId);
    } else {
      q = q.eq("employee_id", profile.id);
    }

    const { data, error } = await q.order("year", { ascending: false }).order("month", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sheets: data ?? [] });
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

    const body = await req.json();
    const { year, month, self_check } = body as {
      year: number; month: number; self_check: unknown[];
    };

    if (!year || !month) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("check_sheets")
      .upsert({
        company_id: profile.company_id,
        employee_id: profile.id,
        year, month,
        self_check: self_check ?? [],
        status: "submitted",
      }, { onConflict: "employee_id,year,month" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sheet: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const profile = await getProfile(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });

    if (!["owner", "approver"].includes(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await req.json();
    const { id, manager_check } = body as { id: string; manager_check: unknown[] };

    if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

    const { error } = await supabase
      .from("check_sheets")
      .update({ manager_check: manager_check ?? [], status: "reviewed" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
