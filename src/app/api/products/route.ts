import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/types/incentive";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = (profile as { company_id?: string } | null)?.company_id;
  if (!companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("company_id");
  if (q && q !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, company_id, name, cost_price, is_active, notes, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  const pr = profile as { role?: string; company_id?: string } | null;
  if (!isAdminRole(pr?.role ?? "") || !pr?.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    cost_price?: number;
    notes?: string;
    company_id?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  if (body.company_id && body.company_id !== pr.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      company_id: pr.company_id,
      name: body.name.trim(),
      cost_price: Number(body.cost_price ?? 0),
      notes: body.notes ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ product: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  const pr = profile as { role?: string; company_id?: string } | null;
  if (!isAdminRole(pr?.role ?? "") || !pr?.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    cost_price?: number;
    is_active?: boolean;
    name?: string;
    notes?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.cost_price != null) patch.cost_price = body.cost_price;
  if (body.is_active != null) patch.is_active = body.is_active;
  if (body.name != null) patch.name = body.name;
  if (body.notes !== undefined) patch.notes = body.notes;

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", body.id)
    .eq("company_id", pr.company_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ product: data });
}
