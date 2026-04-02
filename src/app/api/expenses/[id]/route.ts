import { getProfile, getSessionUser } from "@/lib/api-auth";
import { isActiveExpenseCategoryLabel } from "@/lib/expense-category-validate";
import type { ExpenseType } from "@/types/index";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function isExpenseType(x: string): x is ExpenseType {
  return (
    x === "expense" ||
    x === "travel" ||
    x === "advance" ||
    x === "advance_settle"
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ expense: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: row, error: fe } = await supabase
      .from("expenses")
      .select("id, status, submitter_id")
      .eq("id", id)
      .single();
    if (fe || !row) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }
    const r = row as { status: string; submitter_id: string };
    if (r.submitter_id !== user.id) {
      return NextResponse.json({ error: "編集権限がありません" }, { status: 403 });
    }
    if (r.status !== "draft") {
      return NextResponse.json({ error: "下書きのみ編集できます" }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.type != null) {
      const t = String(body.type);
      if (!isExpenseType(t)) {
        return NextResponse.json({ error: "無効な申請種別です" }, { status: 400 });
      }
      patch.type = t;
    }
    if (body.category != null) {
      const c = String(body.category);
      const profile = await getProfile(supabase, user.id);
      if (!profile) {
        return NextResponse.json({ error: "プロフィールがありません" }, { status: 403 });
      }
      const ok = await isActiveExpenseCategoryLabel(supabase, profile.company_id, c);
      if (!ok) {
        return NextResponse.json({ error: "カテゴリが不正です" }, { status: 400 });
      }
      patch.category = c;
    }
    if (body.amount != null) {
      const a = Number(body.amount);
      if (!Number.isFinite(a) || a <= 0) {
        return NextResponse.json({ error: "金額は正の数必須です" }, { status: 400 });
      }
      patch.amount = a;
    }
    if (body.paid_date != null) {
      const d = String(body.paid_date).trim();
      if (!d) {
        return NextResponse.json({ error: "paid_date は必須です" }, { status: 400 });
      }
      patch.paid_date = d;
    }
    if (body.vendor != null) {
      const v = String(body.vendor).trim();
      if (!v) {
        return NextResponse.json({ error: "vendor は必須です" }, { status: 400 });
      }
      patch.vendor = v;
    }
    if (body.purpose != null) {
      const p = String(body.purpose).trim();
      if (!p) {
        return NextResponse.json({ error: "purpose は必須です" }, { status: 400 });
      }
      patch.purpose = p;
    }
    if (body.receipt_url !== undefined) {
      patch.receipt_url = body.receipt_url == null ? null : String(body.receipt_url);
    }
    if (body.attendees !== undefined) {
      patch.attendees = body.attendees == null ? null : String(body.attendees);
    }
    if (body.from_location !== undefined) {
      patch.from_location = body.from_location == null ? null : String(body.from_location);
    }
    if (body.to_location !== undefined) {
      patch.to_location = body.to_location == null ? null : String(body.to_location);
    }
    if (body.department_id !== undefined) {
      patch.department_id =
        body.department_id == null || body.department_id === ""
          ? null
          : String(body.department_id);
    }
    if (body.receipt_ocr_data !== undefined) {
      patch.receipt_ocr_data =
        body.receipt_ocr_data && typeof body.receipt_ocr_data === "object"
          ? (body.receipt_ocr_data as Record<string, unknown>)
          : null;
    }

    if (body.submitter_name != null) {
      patch.submitter_name = String(body.submitter_name);
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
    }

    const { data: updated, error: upErr } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ expense: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: row, error: fe } = await supabase
      .from("expenses")
      .select("id, status, submitter_id")
      .eq("id", id)
      .single();
    if (fe || !row) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }
    const r = row as { status: string; submitter_id: string };
    if (r.submitter_id !== user.id) {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }
    if (r.status !== "draft") {
      return NextResponse.json({ error: "下書きのみ削除できます" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error: delErr } = await admin.from("expenses").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
