import { getProfile, getSessionUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function slugCode(label: string) {
  const ascii = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 48);
  if (ascii.length >= 2) return ascii;
  return `cat_${Date.now().toString(36)}`;
}

export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("expense_categories")
      .select("id, company_id, code, label, sort_order, is_active")
      .eq("company_id", profile.company_id)
      .order("sort_order", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ categories: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const me = await getProfile(supabase, user.id);
    if (!me || me.role !== "owner") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as {
      label?: string;
      code?: string;
      sort_order?: number;
    };
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "label が必要です" }, { status: 400 });
    }
    const code = (body.code?.trim() || slugCode(label)).slice(0, 64);
    const sortOrder =
      body.sort_order != null && Number.isFinite(Number(body.sort_order))
        ? Math.floor(Number(body.sort_order))
        : 100;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("expense_categories")
      .insert({
        company_id: me.company_id,
        code,
        label,
        sort_order: sortOrder,
        is_active: true,
      })
      .select("id, code, label, sort_order, is_active")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const me = await getProfile(supabase, user.id);
    if (!me || me.role !== "owner") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as {
      id?: string;
      label?: string;
      sort_order?: number;
      is_active?: boolean;
    };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.label != null) patch.label = String(body.label).trim();
    if (body.sort_order != null && Number.isFinite(Number(body.sort_order))) {
      patch.sort_order = Math.floor(Number(body.sort_order));
    }
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("expense_categories")
      .select("company_id")
      .eq("id", id)
      .maybeSingle();
    if (!row || (row as { company_id: string }).company_id !== me.company_id) {
      return NextResponse.json({ error: "カテゴリが見つかりません" }, { status: 404 });
    }

    const { error } = await admin
      .from("expense_categories")
      .update(patch)
      .eq("id", id)
      .eq("company_id", me.company_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
