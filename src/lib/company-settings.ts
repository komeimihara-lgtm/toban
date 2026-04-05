import type { CompanySettings } from "@/types/index";

/** DB の companies.settings（JSONB）を正規化 */
export function normalizeCompanySettings(raw: unknown): CompanySettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const notificationRaw = o.notification;
  const notificationObj =
    notificationRaw && typeof notificationRaw === "object"
      ? (notificationRaw as Record<string, unknown>)
      : {};
  const ch = notificationObj.channels;
  const channels = Array.isArray(ch)
    ? ch.map((x) => String(x)).filter((x) => x === "line" || x === "email")
    : ["line"];

  return {
    notification: {
      channels:
        channels.length > 0
          ? (channels as CompanySettings["notification"]["channels"])
          : ["line"],
    },
  };
}

export function usesLineChannel(settings: CompanySettings) {
  return settings.notification.channels.includes("line");
}

export function usesEmailChannel(settings: CompanySettings) {
  return settings.notification.channels.includes("email");
}
