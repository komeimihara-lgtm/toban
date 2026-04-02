import { getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("onboarding_tasks")
    .update({
      status: "completed",
      completed_at: now,
      completed: true,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
