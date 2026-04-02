import { createHmac, timingSafeEqual } from "node:crypto";

export type AttendanceQrPayload = {
  uid: string;
  exp: number;
  pt: "clock_in" | "clock_out";
};

function getSecret(): string {
  const s = process.env.ATTENDANCE_QR_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ATTENDANCE_QR_SECRET が設定されていません。");
  }
  return "dev-lenard-attendance-qr-insecure";
}

export function signAttendanceQrToken(payload: AttendanceQrPayload): string {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sig}`;
}

export function verifyAttendanceQrToken(token: string): AttendanceQrPayload | null {
  try {
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const b64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const body = Buffer.from(b64, "base64url").toString("utf8");
    const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(body) as AttendanceQrPayload;
    if (
      !payload.uid ||
      typeof payload.exp !== "number" ||
      (payload.pt !== "clock_in" && payload.pt !== "clock_out")
    ) {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
