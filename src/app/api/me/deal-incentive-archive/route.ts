import { getProfile, getSessionUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MonthBucket = {
  year: number;
  month: number;
  approved_total: number;
  pending_total: number;
  submitted_count: number;
};

/** ログインユーザーが関与した案件の月別インセンティブ集計（最大12ヶ月） */
export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    const url = new URL(req.url);
    const n = Math.min(24, Math.max(1, Number(url.searchParams.get("months") ?? 12)));

    const buckets: MonthBucket[] = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;

      const { data: rows } = await supabase
        .from("deals")
        .select("submit_status, appo_incentive, closer_incentive, appo_employee_id, closer_employee_id")
        .eq("company_id", profile.company_id)
        .eq("year", y)
        .eq("month", m)
        .or(`appo_employee_id.eq.${user.id},closer_employee_id.eq.${user.id}`);

      let approved_total = 0;
      let pending_total = 0;
      let submitted_count = 0;
      for (const raw of rows ?? []) {
        const r = raw as {
          submit_status: string;
          appo_incentive: number;
          closer_incentive: number;
          appo_employee_id: string | null;
          closer_employee_id: string | null;
        };
        let mine = 0;
        if (r.appo_employee_id === user.id) mine += Number(r.appo_incentive ?? 0);
        if (r.closer_employee_id === user.id) mine += Number(r.closer_incentive ?? 0);
        if (r.submit_status === "approved") approved_total += mine;
        else if (r.submit_status === "submitted") pending_total += mine;
        if (r.submit_status === "submitted") submitted_count += 1;
      }
      buckets.push({ year: y, month: m, approved_total, pending_total, submitted_count });
    }

    return NextResponse.json({ months: buckets });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
