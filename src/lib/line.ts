/** LINE Messaging API（プッシュ）。チャネルアクセストークンと送信先 userId が必要。 */

export async function pushLineMessage(to: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN 未設定 — スキップ:", text.slice(0, 80));
    return { ok: false as const, skipped: true };
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[line] push failed:", res.status, err);
    return { ok: false as const, status: res.status };
  }
  return { ok: true as const };
}

export async function notifyLineUsers(text: string) {
  const raw = process.env.LINE_HR_NOTIFY_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of ids) {
    await pushLineMessage(id, text);
  }
}
