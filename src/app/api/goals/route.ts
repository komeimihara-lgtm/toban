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
      .from("monthly_goals")
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
    return NextResponse.json({ goals: data ?? [] });
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
    const { year, month, theme, goals, kpis } = body as {
      year: number; month: number; theme: string;
      goals: unknown[]; kpis: unknown[];
    };

    if (!year || !month || !theme?.trim()) {
      return NextResponse.json({ error: "year, month, theme が必要です" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("monthly_goals")
      .upsert({
        company_id: profile.company_id,
        employee_id: profile.id,
        year, month,
        theme: theme.trim(),
        goals: goals ?? [],
        kpis: kpis ?? [],
        status: "draft",
        updated_at: new Date().toISOString(),
      }, { onConflict: "employee_id,year,month" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ goal: data });
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

    const body = await req.json();
    const { id, action, result_input, reject_reason } = body as {
      id: string; action: string;
      result_input?: unknown; reject_reason?: string;
    };

    if (!id || !action) {
      return NextResponse.json({ error: "id, action が必要です" }, { status: 400 });
    }

    if (action === "submit") {
      const { error } = await supabase
        .from("monthly_goals")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("employee_id", profile.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "submit_result") {
      const { error } = await supabase
        .from("monthly_goals")
        .update({
          result_input: result_input ?? {},
          result_submitted_at: new Date().toISOString(),
          status: "result_submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("employee_id", profile.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "approve") {
      if (!["owner", "approver"].includes(profile.role)) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const { error } = await supabase
        .from("monthly_goals")
        .update({
          status: "approved",
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "reject") {
      if (!["owner", "approver"].includes(profile.role)) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const { error } = await supabase
        .from("monthly_goals")
        .update({
          status: "rejected",
          result_input: { reject_reason: reject_reason ?? "" },
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "無効な action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
