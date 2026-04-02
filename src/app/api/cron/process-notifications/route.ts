import { pushLineMessage } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const MAX_BATCH = 50;

function resendFrom() {
  return process.env.RESEND_FROM?.trim() || "LENARD HR <onboarding@resend.dev>";
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

  const { data: rows, error: qErr } = await admin
    .from("notification_queue")
    .select("id, channel, recipient_line_id, recipient_email, message, subject")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of rows ?? []) {
    const r = row as {
      id: string;
      channel: string;
      recipient_line_id: string | null;
      recipient_email: string | null;
      message: string;
      subject: string | null;
    };

    try {
      if (r.channel === "line") {
        const to = r.recipient_line_id?.trim();
        if (!to) {
          await admin
            .from("notification_queue")
            .update({
              status: "failed",
              error: "recipient_line_id がありません",
            })
            .eq("id", r.id);
          failed += 1;
          continue;
        }
        const result = await pushLineMessage(to, r.message);
        if (!result.ok) {
          const errMsg =
            "skipped" in result && result.skipped
              ? "LINE_CHANNEL_ACCESS_TOKEN 未設定"
              : `LINE API status ${(result as { status?: number }).status ?? "error"}`;
          await admin
            .from("notification_queue")
            .update({ status: "failed", error: errMsg })
            .eq("id", r.id);
          failed += 1;
          continue;
        }
        await admin
          .from("notification_queue")
          .update({ status: "sent", sent_at: now, error: null })
          .eq("id", r.id);
        sent += 1;
        continue;
      }

      if (r.channel === "email") {
        const to = r.recipient_email?.trim();
        if (!to) {
          await admin
            .from("notification_queue")
            .update({
              status: "failed",
              error: "recipient_email がありません",
            })
            .eq("id", r.id);
          failed += 1;
          continue;
        }
        if (!resend) {
          await admin
            .from("notification_queue")
            .update({
              status: "failed",
              error: "RESEND_API_KEY 未設定",
            })
            .eq("id", r.id);
          failed += 1;
          continue;
        }
        const subj =
          r.subject?.trim() ||
          `【LENARD HR】お知らせ（${r.id.slice(0, 8)}）`;
        const { error: sendErr } = await resend.emails.send({
          from: resendFrom(),
          to: [to],
          subject: subj,
          html: r.message,
        });
        if (sendErr) {
          await admin
            .from("notification_queue")
            .update({
              status: "failed",
              error: sendErr.message,
            })
            .eq("id", r.id);
          failed += 1;
          continue;
        }
        await admin
          .from("notification_queue")
          .update({ status: "sent", sent_at: now, error: null })
          .eq("id", r.id);
        sent += 1;
        continue;
      }

      await admin
        .from("notification_queue")
        .update({ status: "failed", error: `不明な channel: ${r.channel}` })
        .eq("id", r.id);
      failed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      await admin
        .from("notification_queue")
        .update({ status: "failed", error: msg })
        .eq("id", r.id);
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: (rows ?? []).length,
    sent,
    failed,
  });
}
