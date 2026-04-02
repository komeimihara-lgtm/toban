import type { CompanySettings } from "@/types/index";

/** DB の companies.settings（JSONB）を正規化 */
export function normalizeCompanySettings(raw: unknown): CompanySettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const approvalRaw = o.approval;
  const approvalObj =
    approvalRaw && typeof approvalRaw === "object"
      ? (approvalRaw as Record<string, unknown>)
      : {};
  const flow = approvalObj.flow === "one_step" ? "one_step" : "two_step";
  const stepsRaw = approvalObj.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw
        .map((s, i) => {
          if (!s || typeof s !== "object") return null;
          const r = s as Record<string, unknown>;
          const role = String(r.approver_role ?? "approver");
          const approver_role =
            role === "owner" || role === "approver" || role === "staff"
              ? role
              : "approver";
          return {
            order: Number(r.order) || i + 1,
            approver_role,
            label: r.label != null ? String(r.label) : `段階 ${i + 1}`,
          };
        })
        .filter(Boolean)
    : [];

  const notificationRaw = o.notification;
  const notificationObj =
    notificationRaw && typeof notificationRaw === "object"
      ? (notificationRaw as Record<string, unknown>)
      : {};
  const ch = notificationObj.channels;
  const channels = Array.isArray(ch)
    ? ch.map((x) => String(x)).filter((x) => x === "line" || x === "email")
    : ["line"];

  const incentiveRaw = o.incentive;
  const incentiveObj =
    incentiveRaw && typeof incentiveRaw === "object"
      ? (incentiveRaw as Record<string, unknown>)
      : {};

  const defaultSteps =
    flow === "one_step"
      ? [{ order: 1, approver_role: "owner" as const, label: "承認" }]
      : [
          { order: 1, approver_role: "approver" as const, label: "第1承認" },
          { order: 2, approver_role: "owner" as const, label: "最終承認" },
        ];

  return {
    approval: {
      flow,
      steps:
        steps.length > 0
          ? (steps as CompanySettings["approval"]["steps"])
          : defaultSteps,
    },
    notification: {
      channels:
        channels.length > 0
          ? (channels as CompanySettings["notification"]["channels"])
          : ["line"],
    },
    incentive: {
      use_department_incentive_flag:
        incentiveObj.use_department_incentive_flag !== false,
      notes:
        incentiveObj.notes != null ? String(incentiveObj.notes) : undefined,
    },
  };
}

export function usesLineChannel(settings: CompanySettings) {
  return settings.notification.channels.includes("line");
}

export function usesEmailChannel(settings: CompanySettings) {
  return settings.notification.channels.includes("email");
}

/** PATCH 用: DB の既存 JSONB と部分オブジェクトをマージしてから正規化 */
export function mergeCompanySettingsPatch(
  existing: unknown,
  patch: unknown,
): CompanySettings {
  const e =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : {};
  const p =
    patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...e };
  if (p.approval && typeof p.approval === "object") {
    merged.approval = {
      ...(typeof e.approval === "object" && e.approval
        ? (e.approval as Record<string, unknown>)
        : {}),
      ...(p.approval as Record<string, unknown>),
    };
  } else if ("approval" in p && p.approval === null) {
    delete merged.approval;
  }
  if (p.notification && typeof p.notification === "object") {
    merged.notification = {
      ...(typeof e.notification === "object" && e.notification
        ? (e.notification as Record<string, unknown>)
        : {}),
      ...(p.notification as Record<string, unknown>),
    };
  }
  if (p.incentive && typeof p.incentive === "object") {
    merged.incentive = {
      ...(typeof e.incentive === "object" && e.incentive
        ? (e.incentive as Record<string, unknown>)
        : {}),
      ...(p.incentive as Record<string, unknown>),
    };
  }
  return normalizeCompanySettings(merged);
}
