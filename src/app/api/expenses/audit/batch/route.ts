import { getProfile, getSessionUser } from "@/lib/api-auth";
import {
  parseDealCountFromPurpose,
  parseNightsFromPurpose,
} from "@/lib/expense-audit-purpose-parse";
import { fetchSalesTargetUserIds } from "@/lib/employee-sales-target";
import Anthropic from "@anthropic-ai/sdk";
import { isAdminRole } from "@/types/incentive";
import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-20250514";

export const maxDuration = 180;

type DeptAgg = {
  department_id: string | null;
  department_name: string;
  total: number;
  count: number;
  transport_total: number;
};

type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  paid_date: string;
  submitter_id: string;
  submitter_name: string | null;
  audit_score: number | null;
  department_id: string | null;
  purpose: string | null;
  to_location: string | null;
};

/** 会社推奨の宿泊費レンジ（上限を超過分の試算に使用） */
const HOTEL_RECOMMENDED_RANGE_LABEL = "¥8,000前後/泊（ビジネスホテル目安）";
const HOTEL_CAP_PER_NIGHT_JPY = 8000;

function estimateLodgingNights(amount: number, purpose: string | null): number {
  const parsed = parseNightsFromPurpose(String(purpose ?? ""));
  if (parsed != null) return Math.max(1, parsed);
  return Math.max(1, Math.round(amount / HOTEL_CAP_PER_NIGHT_JPY));
}

function lodgingExcessOverCapJpy(amount: number, nights: number): number {
  const cap = HOTEL_CAP_PER_NIGHT_JPY * Math.max(1, nights);
  return Math.max(0, Math.round(amount - cap));
}

function heuristicSavingJpy(
  category: string,
  amount: number,
  purpose?: string | null,
): number {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return 0;
  if (/交通/.test(category)) return Math.round(a * 0.35);
  if (/宿泊|ホテル/.test(category)) {
    const n = estimateLodgingNights(a, purpose ?? null);
    const ex = lodgingExcessOverCapJpy(a, n);
    return ex > 0 ? ex : Math.round(a * 0.12);
  }
  if (/接待|交際/.test(category)) return Math.round(a * 0.15);
  return Math.round(a * 0.12);
}

function isTransportCat(c: string) {
  return c === "交通費" || c.includes("交通");
}

function isLodgingCat(c: string) {
  return c.includes("宿泊") || c.includes("ホテル");
}

function normalizeAreaHint(to: string | null, purpose: string | null): string {
  const pool = `${to ?? ""} ${purpose ?? ""}`;
  const m = pool.match(
    /東京|大阪|名古屋|福岡|横浜|札幌|仙台|広島|京都|神戸|千葉|博多|天神|梅田/,
  );
  return m ? m[0] : (to ?? "").trim().slice(0, 24) || "（エリア不明）";
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const profile = await getProfile(supabase, user.id);
    if (!profile || !isAdminRole(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { year?: number; month?: number };
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month が必要です" }, { status: 400 });
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(year, month, 0).getDate();
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${String(last).padStart(2, "0")}`;

    const { data: rows, error } = await supabase
      .from("expenses")
      .select(
        "id, amount, category, paid_date, submitter_id, submitter_name, audit_score, department_id, purpose, to_location",
      )
      .eq("company_id", profile.company_id)
      .gte("paid_date", start)
      .lte("paid_date", end);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawList = (rows ?? []) as ExpenseRow[];

    const { data: arRows } = await supabase
      .from("activity_reports")
      .select("employee_id, visit_count, meeting_count, report_date, area")
      .eq("company_id", profile.company_id)
      .gte("report_date", start)
      .lte("report_date", end);

    function aggregateActivity(rows: unknown[] | null) {
      const m = new Map<string, { visits: number; meetings: number }>();
      for (const r of rows ?? []) {
        const row = r as {
          employee_id: string;
          visit_count: number;
          meeting_count: number;
        };
        const cur = m.get(row.employee_id) ?? { visits: 0, meetings: 0 };
        cur.visits += Number(row.visit_count ?? 0);
        cur.meetings += Number(row.meeting_count ?? 0);
        m.set(row.employee_id, cur);
      }
      return m;
    }

    const activityByEmployee = aggregateActivity(arRows ?? []);

    const salesIdList = await fetchSalesTargetUserIds(supabase, profile.company_id);
    const salesIds = new Set(salesIdList);

    const { data: salesProfilesRaw } =
      salesIdList.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", salesIdList)
        : { data: [] as { id: string; full_name: string | null }[] };

    const salesProfiles = salesProfilesRaw ?? [];

    const deptIds = [
      ...new Set(rawList.map((r) => r.department_id).filter(Boolean)),
    ] as string[];
    const nameByDept: Record<string, string> = {};
    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", deptIds);
      for (const d of depts ?? []) {
        nameByDept[(d as { id: string }).id] = (d as { name: string }).name;
      }
    }

    const list = rawList.map((r) => ({
      ...r,
      department_name: r.department_id
        ? (nameByDept[r.department_id] ?? "不明部署")
        : "未所属",
    }));

    const byDept = new Map<string | null, DeptAgg>();
    let monthTotal = 0;
    let transportTotal = 0;
    const savingsByCategory = new Map<string, number>();

    for (const r of list) {
      monthTotal += Number(r.amount);
      const dname = r.department_name;
      const key = r.department_id;
      let a = byDept.get(key);
      if (!a) {
        a = {
          department_id: key,
          department_name: dname,
          total: 0,
          count: 0,
          transport_total: 0,
        };
        byDept.set(key, a);
      }
      a.total += Number(r.amount);
      a.count += 1;
      if (isTransportCat(r.category)) {
        a.transport_total += Number(r.amount);
        transportTotal += Number(r.amount);
      }
      const sav = heuristicSavingJpy(r.category, Number(r.amount), r.purpose);
      const ck = r.category || "（未分類）";
      savingsByCategory.set(ck, (savingsByCategory.get(ck) ?? 0) + sav);
    }

    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const lastPrev = new Date(prevY, prevM, 0).getDate();
    const pStart = `${prevY}-${pad(prevM)}-01`;
    const pEnd = `${prevY}-${pad(prevM)}-${String(lastPrev).padStart(2, "0")}`;
    const [{ data: prevRows }, { data: arPrevRows }] = await Promise.all([
      supabase
        .from("expenses")
        .select(
          "amount, category, paid_date, submitter_id, purpose, to_location",
        )
        .eq("company_id", profile.company_id)
        .gte("paid_date", pStart)
        .lte("paid_date", pEnd),
      supabase
        .from("activity_reports")
        .select("employee_id, visit_count, meeting_count")
        .eq("company_id", profile.company_id)
        .gte("report_date", pStart)
        .lte("report_date", pEnd),
    ]);
    const prevList = (prevRows ?? []) as {
      amount: number;
      category: string;
      purpose: string | null;
      submitter_id: string;
    }[];
    const prevActivityByEmployee = aggregateActivity(arPrevRows ?? []);

    const prevTransport = prevList.reduce((s, r) => {
      if (isTransportCat(r.category)) return s + Number(r.amount);
      return s;
    }, 0);

    const lodgingRows = list.filter((r) => isLodgingCat(r.category));
    let lodgingTotalJpy = 0;
    let lodgingExcessTotalJpy = 0;
    const lodgingItems: {
      id: string;
      submitter_name: string | null;
      paid_date: string;
      category: string;
      amount_jpy: number;
      estimated_nights: number;
      per_night_jpy: number;
      excess_over_recommended_jpy: number;
    }[] = [];
    for (const r of lodgingRows) {
      const amt = Number(r.amount);
      lodgingTotalJpy += amt;
      const n = estimateLodgingNights(amt, r.purpose);
      const perNight = Math.round(amt / n);
      const ex = lodgingExcessOverCapJpy(amt, n);
      lodgingExcessTotalJpy += ex;
      lodgingItems.push({
        id: r.id,
        submitter_name: r.submitter_name,
        paid_date: r.paid_date,
        category: r.category,
        amount_jpy: Math.round(amt),
        estimated_nights: n,
        per_night_jpy: perNight,
        excess_over_recommended_jpy: ex,
      });
    }
    lodgingItems.sort((a, b) => b.excess_over_recommended_jpy - a.excess_over_recommended_jpy);

    const lodging_vs_recommended = {
      recommended_range_per_night: HOTEL_RECOMMENDED_RANGE_LABEL,
      cap_per_night_jpy: HOTEL_CAP_PER_NIGHT_JPY,
      lodging_expense_count: lodgingRows.length,
      total_lodging_jpy: Math.round(lodgingTotalJpy),
      total_excess_over_recommended_jpy: Math.round(lodgingExcessTotalJpy),
      items: lodgingItems.slice(0, 25),
    };

    const allProposals: {
      id: string;
      amount: number;
      category: string;
      submitter_name: string | null;
      paid_date: string;
      heuristic_saving: number;
    }[] = list.map((r) => ({
      id: r.id,
      amount: r.amount,
      category: r.category,
      submitter_name: r.submitter_name,
      paid_date: r.paid_date,
      heuristic_saving: heuristicSavingJpy(r.category, r.amount, r.purpose),
    }));
    allProposals.sort((a, b) => b.heuristic_saving - a.heuristic_saving);
    const reduction_candidates = allProposals.slice(0, 15);
    const reduction_proposals_top5 = allProposals.slice(0, 5);

    const category_savings_jpy = Object.fromEntries(
      [...savingsByCategory.entries()].sort((x, y) => y[1] - x[1]),
    );
    const suggested_savings_jpy = [...savingsByCategory.values()].reduce(
      (s, v) => s + v,
      0,
    );
    const annual_savings_projection_jpy = Math.round(suggested_savings_jpy * 12);

    const lowScores = list
      .filter((r) => r.audit_score != null && r.audit_score < 50)
      .sort((a, b) => Number(a.audit_score) - Number(b.audit_score))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        amount: r.amount,
        category: r.category,
        submitter_name: r.submitter_name,
        audit_score: r.audit_score,
        paid_date: r.paid_date,
      }));

    const department_stats = [...byDept.values()].sort((a, b) => b.total - a.total);

    type StaffEff = {
      submitter_id: string;
      full_name: string;
      transport_jpy: number;
      lodging_jpy: number;
      estimated_deals: number;
      cost_per_deal_jpy: number;
    };

    const staffEffList: StaffEff[] = [];
    const salesNameById = new Map<string, string | null>();
    for (const p of salesProfiles ?? []) {
      const row = p as { id: string; full_name: string | null };
      salesNameById.set(row.id, row.full_name);
    }
    for (const sid of salesIds) {
      const fullName = salesNameById.get(sid) ?? null;
      const my = list.filter((e) => e.submitter_id === sid);
      let transport_jpy = 0;
      let lodging_jpy = 0;
      let purposeDeals = 0;
      for (const e of my) {
        if (isTransportCat(e.category)) transport_jpy += Number(e.amount);
        if (isLodgingCat(e.category)) lodging_jpy += Number(e.amount);
        const pc = parseDealCountFromPurpose(String(e.purpose ?? ""));
        if (pc != null) purposeDeals += pc;
      }
      const ar = activityByEmployee.get(sid);
      const arDeals = (ar?.visits ?? 0) + (ar?.meetings ?? 0);
      const estimatedDeals = Math.max(1, purposeDeals + arDeals);
      const costPerDeal =
        transport_jpy > 0 ? Math.round(transport_jpy / estimatedDeals) : 0;
      if (transport_jpy > 0 || lodging_jpy > 0 || purposeDeals + arDeals > 0) {
        staffEffList.push({
          submitter_id: sid,
          full_name: fullName ?? sid.slice(0, 8),
          transport_jpy: Math.round(transport_jpy),
          lodging_jpy: Math.round(lodging_jpy),
          estimated_deals: estimatedDeals,
          cost_per_deal_jpy: costPerDeal,
        });
      }
    }
    staffEffList.sort((a, b) => a.cost_per_deal_jpy - b.cost_per_deal_jpy);
    const sales_ranking_by_cost_per_deal = staffEffList.map((s, i) => ({
      rank: i + 1,
      ...s,
    }));

    const movers = staffEffList.filter((s) => s.transport_jpy > 0);
    const teamAvgCost =
      movers.length > 0
        ? Math.round(
            movers.reduce((acc, s) => acc + s.cost_per_deal_jpy, 0) /
              movers.length,
          )
        : 0;

    const prevStaffCosts: number[] = [];
    for (const sid of salesIds) {
      const my = prevList.filter((e) => e.submitter_id === sid);
      let t = 0;
      let pd = 0;
      for (const e of my) {
        if (isTransportCat(e.category)) t += Number(e.amount);
        const pc = parseDealCountFromPurpose(String(e.purpose ?? ""));
        if (pc != null) pd += pc;
      }
      const arP = prevActivityByEmployee.get(sid);
      const arDealsPrev = (arP?.visits ?? 0) + (arP?.meetings ?? 0);
      const ed = Math.max(1, pd + arDealsPrev);
      if (t > 0) prevStaffCosts.push(Math.round(t / ed));
    }
    const prevTeamAvg =
      prevStaffCosts.length > 0
        ? Math.round(
            prevStaffCosts.reduce((a, b) => a + b, 0) / prevStaffCosts.length,
          )
        : 0;

    const tripMap = new Map<string, { count: number; total: number; name: string }>();
    for (const r of list) {
      if (!salesIds.has(r.submitter_id)) continue;
      if (!isTransportCat(r.category)) continue;
      const hint = normalizeAreaHint(r.to_location, r.purpose);
      const k = `${r.submitter_id}::${hint}`;
      const cur = tripMap.get(k) ?? { count: 0, total: 0, name: hint };
      cur.count += 1;
      cur.total += Number(r.amount);
      tripMap.set(k, cur);
    }
    const consolidation_suggestions: {
      submitter_name: string | null;
      area_hint: string;
      trip_count: number;
      total_jpy: number;
      suggested_saving_jpy: number;
      note: string;
    }[] = [];
    const nameById = new Map<string, string | null>();
    for (const r of list) {
      if (!nameById.has(r.submitter_id))
        nameById.set(r.submitter_id, r.submitter_name);
    }
    for (const [key, v] of tripMap) {
      if (v.count < 3) continue;
      const sid = key.split("::")[0];
      consolidation_suggestions.push({
        submitter_name: nameById.get(sid) ?? null,
        area_hint: v.name,
        trip_count: v.count,
        total_jpy: Math.round(v.total),
        suggested_saving_jpy: Math.round(v.total * 0.3),
        note: `同地域への出張が ${v.count} 件あります。日程をまとめると交通費の重複を抑えられる可能性があります。`,
      });
    }
    consolidation_suggestions.sort((a, b) => b.suggested_saving_jpy - a.suggested_saving_jpy);

    let online_shift_estimate_jpy = 0;
    for (const s of movers) {
      if (teamAvgCost > 0 && s.cost_per_deal_jpy > teamAvgCost * 1.15) {
        online_shift_estimate_jpy += Math.round(s.transport_jpy * 0.25);
      }
    }

    /** 直近6ヶ月のチーム平均（商談1件あたり移動コスト）・全社交通費・宿泊÷件数の推移 */
    const monthly_trend: {
      year: number;
      month: number;
      team_avg_cost_per_deal_jpy: number;
      company_transport_jpy: number;
      lodging_per_deal_jpy: number;
    }[] = [];
    for (let back = 5; back >= 0; back--) {
      let yy = year;
      let mm = month - back;
      while (mm < 1) {
        yy--;
        mm += 12;
      }
      const lastTrend = new Date(yy, mm, 0).getDate();
      const rStart = `${yy}-${pad(mm)}-01`;
      const rEnd = `${yy}-${pad(mm)}-${String(lastTrend).padStart(2, "0")}`;
      const [{ data: trendExp }, { data: trendAr }] = await Promise.all([
        supabase
          .from("expenses")
          .select("amount, category, purpose, submitter_id")
          .eq("company_id", profile.company_id)
          .gte("paid_date", rStart)
          .lte("paid_date", rEnd),
        supabase
          .from("activity_reports")
          .select("employee_id, visit_count, meeting_count")
          .eq("company_id", profile.company_id)
          .gte("report_date", rStart)
          .lte("report_date", rEnd),
      ]);
      const tAct = aggregateActivity(trendAr ?? []);
      const tList = (trendExp ?? []) as {
        amount: number;
        category: string;
        purpose: string | null;
        submitter_id: string;
      }[];
      let companyTransport = 0;
      for (const r of tList) {
        if (isTransportCat(r.category)) companyTransport += Number(r.amount);
      }
      const costs: number[] = [];
      const lodgingRatios: number[] = [];
      for (const sid of salesIds) {
        const my = tList.filter((e) => e.submitter_id === sid);
        let t = 0;
        let lod = 0;
        let pd = 0;
        for (const e of my) {
          if (isTransportCat(e.category)) t += Number(e.amount);
          if (isLodgingCat(e.category)) lod += Number(e.amount);
          const pc = parseDealCountFromPurpose(String(e.purpose ?? ""));
          if (pc != null) pd += pc;
        }
        const ar = tAct.get(sid);
        const ed = Math.max(1, pd + (ar?.visits ?? 0) + (ar?.meetings ?? 0));
        if (t > 0) costs.push(t / ed);
        if (lod > 0) lodgingRatios.push(lod / ed);
      }
      const teamAvgM =
        costs.length > 0
          ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
          : 0;
      const lodPer =
        lodgingRatios.length > 0
          ? Math.round(
              lodgingRatios.reduce((a, b) => a + b, 0) / lodgingRatios.length,
            )
          : 0;
      monthly_trend.push({
        year: yy,
        month: mm,
        team_avg_cost_per_deal_jpy: teamAvgM,
        company_transport_jpy: Math.round(companyTransport),
        lodging_per_deal_jpy: lodPer,
      });
    }

    const statsPayload = {
      year,
      month,
      expense_count: list.length,
      month_total_jpy: Math.round(monthTotal),
      transport_total_jpy: Math.round(transportTotal),
      prev_month_transport_jpy: Math.round(prevTransport),
      lodging_vs_recommended,
      department_stats,
      reduction_candidates,
      reduction_proposals_top5,
      category_savings_jpy,
      suggested_savings_jpy,
      annual_savings_projection_jpy,
      low_audit_scores: lowScores,
      sales_efficiency: {
        team_avg_cost_per_deal_jpy: teamAvgCost,
        prev_month_team_avg_cost_per_deal_jpy: prevTeamAvg,
        ranking: sales_ranking_by_cost_per_deal,
        consolidation_suggestions: consolidation_suggestions.slice(0, 10),
        online_shift_estimate_jpy: online_shift_estimate_jpy,
        monthly_trend,
      },
    };

    let approver_notes = "";
    let report_md = "";

    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const sys = `あなたは経費監査の担当として、承認者（第1承認・最終承認）向けの月次サマリーを書く。
厳しすぎず、コスト削減とコンプライアンスのバランスを意識する。
営業向けには「商談1件あたりの移動コスト」の観点と、出張集約・オンライン商談の検討を簡潔に触れる。
部門別は department_stats、カテゴリ別の削減試算は category_savings_jpy を参照し、円建てで触れる。
reduction_proposals_top5 を要約し削減提案TOP5の観点を1-2文で書く。
annual_savings_projection_jpy を使い「このペースで改善すると年間約◯◯万円の削減が見込まれます」と必ず1文入れる（◯◯＝annual_savings_projection_jpy÷10000、小数1桁）。
宿泊は lodging_vs_recommended を参照（目安1泊¥8,000前後の比較）。total_excess_over_recommended_jpy を反映する。
出力は JSON のみ: {"approver_notes":"箇条書きでもよい3-8文","report_md":"マークダウンで部門傾向・注意点・削減の狙いどころ・営業効率のコメント"} `;

      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2500,
        system: sys,
        messages: [
          {
            role: "user",
            content: JSON.stringify(statsPayload, null, 2),
          },
        ],
      });
      const tb = resp.content.find((c) => c.type === "text");
      const raw = tb?.type === "text" ? tb.text : "{}";
      try {
        const cleaned = raw.replace(/```json\s*|```/g, "").trim();
        const j = JSON.parse(cleaned) as {
          approver_notes?: string;
          report_md?: string;
        };
        approver_notes = j.approver_notes ?? "";
        report_md = j.report_md ?? "";
      } catch {
        approver_notes = "集計は完了しました。詳細は数値テーブルを参照してください。";
        report_md = "";
      }
    } else {
      approver_notes = "ANTHROPIC_API_KEY 未設定のため AI レポート本文は省略されました。";
      report_md = "";
    }

    return NextResponse.json({
      ...statsPayload,
      approver_notes,
      report_md,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[expenses/audit/batch]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
