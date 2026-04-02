import {
  getProfile,
  getSessionUser,
  isApprover,
  isOwner,
  isOwnerOrApprover,
} from "@/lib/api-auth";
import { yearMonth } from "@/lib/incentive-rate-resolve";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ expensePending: 0, incentiveDraft: 0, yearMonth: "" });
    }

    const now = new Date();
    const ym = yearMonth(now.getFullYear(), now.getMonth() + 1);

    let expensePending = 0;
    if (isApprover(profile.role)) {
      const { count } = await supabase
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("status", "step1_pending");
      expensePending += count ?? 0;
    }
    if (isOwner(profile.role)) {
      const { count } = await supabase
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("status", "step2_pending");
      expensePending += count ?? 0;
    }

    let incentiveDraft = 0;
    if (isOwnerOrApprover(profile.role)) {
      const { count } = await supabase
        .from("incentive_configs")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft")
        .eq("year", now.getFullYear())
        .eq("month", now.getMonth() + 1);
      incentiveDraft = count ?? 0;
    } else {
      const { count } = await supabase
        .from("incentive_configs")
        .select("*", { count: "exact", head: true })
        .eq("employee_id", user.id)
        .eq("status", "draft")
        .eq("year", now.getFullYear())
        .eq("month", now.getMonth() + 1);
      incentiveDraft = count ?? 0;
    }

    return NextResponse.json({ expensePending, incentiveDraft, yearMonth: ym });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
