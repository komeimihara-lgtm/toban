import { createAdminClient } from "@/lib/supabase/admin";

/** service_role 利用。失敗時はコンソールのみ（開発時） */
export async function enqueueNotification(input: {
  company_id: string;
  type: string;
  recipient_line_id: string | null;
  recipient_email?: string | null;
  message: string;
  channel?: "line" | "email";
  subject?: string | null;
  status?: "pending" | "sent" | "failed";
}) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notification_queue").insert({
      company_id: input.company_id,
      type: input.type,
      recipient_line_id: input.recipient_line_id,
      recipient_email: input.recipient_email ?? null,
      message: input.message,
      channel: input.channel ?? "line",
      subject: input.subject ?? null,
      status: input.status ?? "pending",
    });
    if (error) console.error("notification_queue insert:", error.message);
  } catch (e) {
    console.error("enqueueNotification:", e);
  }
}
