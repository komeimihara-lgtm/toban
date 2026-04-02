import { runRetentionAnalysis } from "@/lib/retention-analyzer";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authorized =
    process.env.NODE_ENV !== "production" ||
    (secret && auth === `Bearer ${secret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetentionAnalysis();
  return NextResponse.json(result);
}
