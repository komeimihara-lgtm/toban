import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** JST 日付 YYYY-MM-DD（サーバー日付基準） */
function todayYmdUtcDate() {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authorized =
    process.env.NODE_ENV !== "production" ||
    (secret && auth === `Bearer ${secret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client unavailable" },
      { status: 503 },
    );
  }

  const today = todayYmdUtcDate();

  const { data: rows, error } = await admin
    .from("employees")
    .select("id, user_id, scheduled_auth_deactivation_date, offboarding_status")
    .eq("offboarding_status", "offboarding")
    .not("scheduled_auth_deactivation_date", "is", null)
    .lte("scheduled_auth_deactivation_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deactivated = 0;
  let errors = 0;

  for (const row of rows ?? []) {
    const r = row as {
      id: string;
      user_id: string;
      scheduled_auth_deactivation_date: string;
    };
    try {
      const { error: banErr } = await admin.auth.admin.updateUserById(r.user_id, {
        ban_duration: "876600h",
      });
      if (banErr) {
        console.error("[cron] auth ban failed", r.user_id, banErr);
        errors += 1;
        continue;
      }
      const { error: upErr } = await admin
        .from("employees")
        .update({ offboarding_status: "left" })
        .eq("id", r.id);
      if (upErr) {
        console.error("[cron] employee update failed", upErr);
        errors += 1;
        continue;
      }
      deactivated += 1;
    } catch (e) {
      console.error("[cron] deactivate row", e);
      errors += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: (rows ?? []).length,
    deactivated,
    errors,
  });
}
