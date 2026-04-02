import { Resend } from "resend";

const COMPANY_NAME = "レナード株式会社";

function baseLayout(inner: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b;">
  <p style="margin:0 0 1em;">${COMPANY_NAME}</p>
  ${inner}
  <p style="margin-top:1.5em; font-size:12px; color:#71717a;">本メールは LENARD HR から自動送信されています。</p>
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
  return process.env.RESEND_FROM?.trim() || "LENARD HR <onboarding@resend.dev>";
}

export type ExpenseEmailContext = {
  companyName?: string;
  applicantName?: string | null;
  category?: string;
  amount?: number;
  statusLabel?: string;
  /** 承認フロー: 例「第1承認待ち」 */
  flowStatus?: string;
  /** メール本文に追記（例: AI自動承認の注記） */
  extraNote?: string;
};

export type IncentiveEmailContext = {
  companyName?: string;
  applicantName?: string | null;
  yearMonth?: string;
  salesAmount?: number | null;
  statusLabel?: string;
};

export type AttendanceCorrectionEmailContext = {
  companyName?: string;
  applicantName?: string | null;
  targetDate?: string;
  statusLabel?: string;
  detail?: string;
};

async function sendHtml(to: string, subject: string, html: string) {
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

/** 通知キュー（メール）用。`message` にそのまま格納して cron で送信。 */
export function buildApprovalRequestMail(expense: ExpenseEmailContext) {
  const co = expense.companyName ?? COMPANY_NAME;
  const name = expense.applicantName?.trim() || "申請者";
  const cat = expense.category ?? "—";
  const amt = expense.amount != null ? `¥${Number(expense.amount).toLocaleString("ja-JP")}` : "—";
  const flow = expense.flowStatus ?? "承認待ち";
  const subject = `【LENARD HR】経費申請の承認依頼`;
  const html = baseLayout(`
    <p>いつもお世話になっております。以下の経費申請の承認をお願いいたします。</p>
    <ul>
      <li>会社名: ${co}</li>
      <li>申請者: ${name}</li>
      <li>科目: ${cat}</li>
      <li>金額: ${amt}</li>
      <li>フロー: ${flow}</li>
    </ul>
    <p>LENARD HR の「承認」画面からご対応ください。</p>
  `);
  return { subject, html };
}

export function buildExpenseApprovedMail(expense: ExpenseEmailContext) {
  const co = expense.companyName ?? COMPANY_NAME;
  const name = expense.applicantName?.trim() || "申請者";
  const cat = expense.category ?? "—";
  const amt = expense.amount != null ? `¥${Number(expense.amount).toLocaleString("ja-JP")}` : "—";
  const subject = `【LENARD HR】経費申請が承認されました`;
  const note = expense.extraNote?.trim()
    ? `<p>${expense.extraNote.trim()}</p>`
    : "";
  const html = baseLayout(`
    <p>${name} 様</p>
    <p>ご申請いただいた経費が承認されました。</p>
    ${note}
    <ul>
      <li>会社名: ${co}</li>
      <li>科目: ${cat}</li>
      <li>金額: ${amt}</li>
      <li>ステータス: 承認完了</li>
    </ul>
    <p>内容は LENARD HR の「申請状況」でご確認ください。</p>
  `);
  return { subject, html };
}

export function buildExpenseRejectedMail(expense: ExpenseEmailContext, reason: string) {
  const co = expense.companyName ?? COMPANY_NAME;
  const name = expense.applicantName?.trim() || "申請者";
  const cat = expense.category ?? "—";
  const amt = expense.amount != null ? `¥${Number(expense.amount).toLocaleString("ja-JP")}` : "—";
  const subject = `【LENARD HR】経費申請の差戻し`;
  const html = baseLayout(`
    <p>${name} 様</p>
    <p>ご申請いただいた経費は差戻しとなりました。内容を修正のうえ、再申請をお願いいたします。</p>
    <ul>
      <li>会社名: ${co}</li>
      <li>科目: ${cat}</li>
      <li>金額: ${amt}</li>
    </ul>
    <p><strong>差戻し理由</strong></p>
    <p>${reason.replace(/\n/g, "<br/>")}</p>
    <p>LENARD HR の「申請状況」から「修正して再申請」がご利用いただけます。</p>
  `);
  return { subject, html };
}

export function buildIncentiveSubmittedMail(config: IncentiveEmailContext) {
  const co = config.companyName ?? COMPANY_NAME;
  const name = config.applicantName?.trim() || "申請者";
  const ym = config.yearMonth ?? "—";
  const sales =
    config.salesAmount != null
      ? `¥${Number(config.salesAmount).toLocaleString("ja-JP")}`
      : "—";
  const subject = `【LENARD HR】インセンティブ提出のお知らせ`;
  const html = baseLayout(`
    <p>インセンティブ実績が提出されました（承認待ち）。</p>
    <ul>
      <li>会社: ${co}</li>
      <li>提出者: ${name}</li>
      <li>対象月: ${ym}</li>
      <li>売上実績: ${sales}</li>
      <li>状況: ${config.statusLabel ?? "承認待ち"}</li>
    </ul>
  `);
  return { subject, html };
}

export function buildAttendanceCorrectionMail(correction: AttendanceCorrectionEmailContext) {
  const co = correction.companyName ?? COMPANY_NAME;
  const name = correction.applicantName?.trim() || "申請者";
  const d = correction.targetDate ?? "—";
  const subject = `【LENARD HR】打刻修正申請のお知らせ`;
  const html = baseLayout(`
    <p>打刻修正申請の状況が更新されました。</p>
    <ul>
      <li>会社: ${co}</li>
      <li>申請者: ${name}</li>
      <li>対象日: ${d}</li>
      <li>状況: ${correction.statusLabel ?? "—"}</li>
    </ul>
    ${correction.detail ? `<p>${correction.detail.replace(/\n/g, "<br/>")}</p>` : ""}
  `);
  return { subject, html };
}

export function buildPaidLeaveGrantedMail(days: number) {
  const subject = `【LENARD HR】有給休暇の付与のお知らせ`;
  const html = baseLayout(`
    <p>有給休暇が付与されました。</p>
    <p><strong>${days}</strong> 日</p>
    <p>付与日・詳細は LENARD HR の「有給・休暇」からご確認ください。</p>
  `);
  return { subject, html };
}

export async function sendApprovalRequestEmail(to: string, expense: ExpenseEmailContext) {
  const { subject, html } = buildApprovalRequestMail(expense);
  return sendHtml(to, subject, html);
}

export async function sendApprovedEmail(to: string, expense: ExpenseEmailContext) {
  const { subject, html } = buildExpenseApprovedMail(expense);
  return sendHtml(to, subject, html);
}

export async function sendRejectedEmail(
  to: string,
  expense: ExpenseEmailContext,
  reason: string,
) {
  const { subject, html } = buildExpenseRejectedMail(expense, reason);
  return sendHtml(to, subject, html);
}

export async function sendIncentiveSubmittedEmail(to: string, config: IncentiveEmailContext) {
  const { subject, html } = buildIncentiveSubmittedMail(config);
  return sendHtml(to, subject, html);
}

export async function sendAttendanceCorrectionEmail(
  to: string,
  correction: AttendanceCorrectionEmailContext,
) {
  const { subject, html } = buildAttendanceCorrectionMail(correction);
  return sendHtml(to, subject, html);
}

export async function sendPaidLeaveGrantedEmail(to: string, days: number) {
  const { subject, html } = buildPaidLeaveGrantedMail(days);
  return sendHtml(to, subject, html);
}

