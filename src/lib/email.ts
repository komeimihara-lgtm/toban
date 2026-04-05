import { Resend } from "resend";

const COMPANY_NAME = "TOBAN";

function baseLayout(inner: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b;">
  <p style="margin:0 0 1em;">${COMPANY_NAME}</p>
  ${inner}
  <p style="margin-top:1.5em; font-size:12px; color:#71717a;">本メールは TOBAN から自動送信されています。</p>
</body>
</html>`;
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

/** Resend 経由のメール送信が可能か（`RESEND_API_KEY` 設定の有無） */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress() {
  return process.env.RESEND_FROM?.trim() || "TOBAN <onboarding@resend.dev>";
}

export async function sendHtml(to: string, subject: string, html: string) {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY 未設定のため送信スキップ:",
      subject,
      "| 宛先:",
      to,
    );
    return { ok: false as const, skipped: true };
  }
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: [to],
    subject,
    html,
  });
  if (error) {
    console.error("[email] send failed:", error);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export type AttendanceCorrectionEmailContext = {
  companyName?: string;
  applicantName?: string | null;
  targetDate?: string;
  statusLabel?: string;
  detail?: string;
};

export function buildAttendanceCorrectionMail(correction: AttendanceCorrectionEmailContext) {
  const co = correction.companyName ?? COMPANY_NAME;
  const name = correction.applicantName?.trim() || "申請者";
  const d = correction.targetDate ?? "—";
  const subject = `【TOBAN】打刻修正申請のお知らせ`;
  const html = baseLayout(`
    <p>打刻修正申請の状況が更新されました。</p>
    <ul>
      <li>店舗: ${co}</li>
      <li>申請者: ${name}</li>
      <li>対象日: ${d}</li>
      <li>状況: ${correction.statusLabel ?? "—"}</li>
    </ul>
    ${correction.detail ? `<p>${correction.detail.replace(/\n/g, "<br/>")}</p>` : ""}
  `);
  return { subject, html };
}

export async function sendAttendanceCorrectionEmail(
  to: string,
  correction: AttendanceCorrectionEmailContext,
) {
  const { subject, html } = buildAttendanceCorrectionMail(correction);
  return sendHtml(to, subject, html);
}
