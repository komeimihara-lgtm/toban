export type HrChatTurn = { role: "user" | "assistant"; content: string };

export function normalizeHrConversationHistory(raw: unknown): HrChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: HrChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const role =
      r.role === "assistant"
        ? ("assistant" as const)
        : r.role === "user"
          ? ("user" as const)
          : null;
    const content = typeof r.content === "string" ? r.content : null;
    if (role && content) out.push({ role, content });
  }
  return out;
}
