import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("deal_incentive_rates")
      .select("id, machine_type, role, rate, is_default, updated_at")
      .eq("company_id", profile.company_id)
      .order("machine_type")
      .order("role");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rates: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile || !isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as {
      rates?: { machine_type: string; role: string; rate: number }[];
    };
    if (!Array.isArray(body.rates)) {
      return NextResponse.json({ error: "rates が必要です" }, { status: 400 });
    }

    for (const r of body.rates) {
      if (!r.machine_type || !r.role) {
        return NextResponse.json({ error: "各 rate に machine_type と role が必要です" }, { status: 400 });
      }
      if (!["appo", "closer", "hito"].includes(r.role)) {
        return NextResponse.json({ error: "role は appo / closer / hito のみです" }, { status: 400 });
      }
      const rt = Number(r.rate);
      if (!Number.isFinite(rt) || rt < 0 || rt > 1) {
        return NextResponse.json({ error: "rate は 0〜1 の数値です" }, { status: 400 });
      }
    }

    const rows = body.rates.map((r) => ({
      company_id: profile.company_id,
      machine_type: r.machine_type.trim(),
      role: r.role,
      rate: Number(r.rate),
      is_default: true,
    }));

    const { error } = await supabase.from("deal_incentive_rates").upsert(rows, {
      onConflict: "company_id,machine_type,role",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
