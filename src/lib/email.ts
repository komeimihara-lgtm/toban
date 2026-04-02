import { Resend } from "resend";

const SUBJECT_PREFIX = "【LENARD HR】";

export async function sendHrEmail(opts: {
  to: string;
  subjectSuffix: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[email] RESEND_API_KEY 未設定 — スキップ:",
      SUBJECT_PREFIX + opts.subjectSuffix,
      opts.to,
    );
    return { ok: false as const, skipped: true };
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from:
      process.env.RESEND_FROM_EMAIL ?? "LENARD HR <onboarding@resend.dev>",
    to: opts.to,
    subject: SUBJECT_PREFIX + opts.subjectSuffix,
    html: opts.html,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { ok: false as const, error };
  }
  return { ok: true as const };
}
