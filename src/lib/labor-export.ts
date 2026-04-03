import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { sumDealServiceCosts, type DealServiceLine } from "@/lib/deals-compute";

export type ExportType = "attendance" | "incentive" | "expense" | "all";

export function tokyoYmd(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export function tokyoHm(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 労基法想定の法定休憩を除いた実働分（1日あたり） */
export function netWorkMinutesFromDay(grossMin: number): number {
  if (grossMin <= 0) return 0;
  let br = 0;
  if (grossMin > 8 * 60) br = 60;
  else if (grossMin > 6 * 60) br = 45;
  return Math.max(0, grossMin - br);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRangeUtc(y: number, m: number) {
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { startIso: start.toISOString(), endIso: end.toISOString(), daysInMonth: end.getUTCDate() };
}

function parseDealServices(raw: unknown): DealServiceLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((x) => ({
    name: String((x as { name?: string }).name ?? ""),
    cost: Number((x as { cost?: number }).cost ?? 0),
  }));
}

type ProfileRow = {
  id: string;
  name: string | null;
  department_id: string | null;
};

export async function buildAttendanceWorkbook(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  month: number,
  nameByDept: Map<string | null, string>,
) {
  const { startIso, endIso, daysInMonth } = monthRangeUtc(year, month);

  const { data: profiles } = await supabase
    .from("employees")
    .select("id, name, department_id")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  const staff = (profiles ?? []) as ProfileRow[];

  const { data: punches } = await supabase
    .from("attendance_punches")
    .select("user_id, punched_at, punch_type")
    .eq("company_id", companyId)
    .gte("punched_at", startIso)
    .lte("punched_at", endIso)
    .order("punched_at", { ascending: true });

  type DayAgg = { ins: string[]; outs: string[] };
  const byUserDay = new Map<string, Map<string, DayAgg>>();
  for (const row of punches ?? []) {
    const uid = String((row as { user_id: string }).user_id);
    const ts = String((row as { punched_at: string }).punched_at);
    const typ = String((row as { punch_type: string }).punch_type);
    const day = tokyoYmd(ts);
    if (!byUserDay.has(uid)) byUserDay.set(uid, new Map());
    const m = byUserDay.get(uid)!;
    if (!m.has(day)) m.set(day, { ins: [], outs: [] });
    const d = m.get(day)!;
    if (typ === "clock_in") d.ins.push(ts);
    else if (typ === "clock_out") d.outs.push(ts);
  }

  const idsForLeave = staff.map((s) => s.id);
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date, kind, reason, status")
    .eq("status", "approved")
    .in("user_id", idsForLeave.length ? idsForLeave : ["00000000-0000-0000-0000-000000000000"])
    .lte("start_date", `${year}-${pad2(month)}-${pad2(daysInMonth)}`)
    .gte("end_date", `${year}-${pad2(month)}-01`);

  /** yyyy-mm-dd が有給と重なる日数（全日のみ簡易カウント） */
  function leaveDaysInMonth(uid: string): number {
    let n = 0;
    const pref = `${year}-${pad2(month)}-`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = pref + pad2(d);
      for (const lr of leaves ?? []) {
        if (String((lr as { user_id: string }).user_id) !== uid) continue;
        if (String((lr as { kind: string }).kind) !== "full") continue;
        const a = String((lr as { start_date: string }).start_date);
        const b = String((lr as { end_date: string }).end_date);
        if (ds >= a.slice(0, 10) && ds <= b.slice(0, 10)) {
          n++;
          break;
        }
      }
    }
    return n;
  }

  const summaryRows: (string | number)[][] = [
    [
      "社員名",
      "部署",
      "出勤日数",
      "欠勤日数",
      "有給取得日数",
      "総実働時間(時間)",
      "残業時間(時間)",
      "みなし残業超過時間(時間)",
    ],
  ];

  const dayRows: (string | number)[][] = [
    ["社員名", "日付", "出勤時刻", "退勤時刻", "実働時間(分)", "休憩控除後(分)", "備考"],
  ];

  const leaveRows: (string | number)[][] = [["社員名", "取得日", "種別", "理由", "承認メモ"]];
  const kindLabel: Record<string, string> = {
    full: "全日",
    half: "半日",
    hour: "時間単位",
  };

  for (const p of staff) {
    const days = byUserDay.get(p.id);
    let workDays = 0;
    let totalNetMin = 0;
    if (days) {
      for (const [, agg] of days) {
        if (!agg.ins.length) continue;
        const inTs = agg.ins.sort()[0]!;
        const outTs = agg.outs.length ? agg.outs.sort().at(-1)! : "";
        const grossMin = outTs
          ? Math.round((new Date(outTs).getTime() - new Date(inTs).getTime()) / 60000)
          : 0;
        const netMin = netWorkMinutesFromDay(grossMin);
        if (grossMin > 0) workDays++;
        totalNetMin += netMin;
      }
    }
    const plDays = leaveDaysInMonth(p.id);
    summaryRows.push([
      p.name ?? "",
      nameByDept.get(p.department_id ?? "") ?? "",
      workDays,
      0,
      plDays,
      Math.round((totalNetMin / 60) * 100) / 100,
      0,
      0,
    ]);

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${pad2(month)}-${pad2(d)}`;
      const agg = days?.get(ds);
      const inTs = agg?.ins.sort()[0];
      const outTs = agg?.outs.length ? agg?.outs.sort().at(-1) : undefined;
      const grossMin =
        inTs && outTs
          ? Math.round((new Date(outTs).getTime() - new Date(inTs).getTime()) / 60000)
          : 0;
      const netMin = netWorkMinutesFromDay(grossMin);
      dayRows.push([
        p.name ?? "",
        ds,
        inTs ? tokyoHm(inTs) : "",
        outTs ? tokyoHm(outTs) : "",
        grossMin,
        netMin,
        "",
      ]);
    }
  }

  for (const lr of leaves ?? []) {
    const uid = String((lr as { user_id: string }).user_id);
    const prof = staff.find((x) => x.id === uid);
    leaveRows.push([
      prof?.name ?? uid,
      String((lr as { start_date: string }).start_date),
      kindLabel[String((lr as { kind: string }).kind)] ?? String((lr as { kind: string }).kind),
      String((lr as { reason: string | null }).reason ?? ""),
      "",
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "勤怠サマリー");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayRows), "日次勤怠");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leaveRows), "有給取得一覧");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function expenseBucket(cat: string) {
  const c = cat.trim();
  if (c.includes("タクシー")) return "taxi";
  if (c.includes("宿泊")) return "lodging";
  if (c.includes("飲食") || c.includes("接待")) return "meal";
  if (c.includes("消耗品")) return "supplies";
  if (c.includes("通信")) return "comm";
  if (c.includes("交通")) return "travel";
  return "other";
}

export async function buildExpenseWorkbook(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  month: number,
  nameById: Map<string, string | null>,
) {
  const end = new Date(year, month, 0).getDate();
  const pdMin = `${year}-${pad2(month)}-01`;
  const pdMax = `${year}-${pad2(month)}-${pad2(end)}`;

  const { data: ex } = await supabase
    .from("expenses")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .gte("paid_date", pdMin)
    .lte("paid_date", pdMax);

  type Agg = {
    travel: number;
    taxi: number;
    lodging: number;
    meal: number;
    supplies: number;
    comm: number;
    other: number;
  };

  const byUser = new Map<string, Agg>();
  const detailRows: (string | number)[][] = [
    ["社員名", "申請日", "カテゴリ", "金額", "内容", "承認者", "承認日"],
  ];

  for (const row of ex ?? []) {
    const r = row as Record<string, unknown>;
    const sid = String(r.submitter_id ?? "");
    const amt = Number(r.amount ?? 0);
    const cat = String(r.category ?? "");
    const bucket = expenseBucket(cat);
    if (!byUser.has(sid)) {
      byUser.set(sid, { travel: 0, taxi: 0, lodging: 0, meal: 0, supplies: 0, comm: 0, other: 0 });
    }
    const a = byUser.get(sid)!;
    a[bucket] += amt;

    const step2At = r.step2_approved_at ? String(r.step2_approved_at).slice(0, 10) : "";
    const step1At = r.step1_approved_at ? String(r.step1_approved_at).slice(0, 10) : "";
    const appr = r.step2_approved_by
      ? nameById.get(String(r.step2_approved_by)) ?? ""
      : r.step1_approved_by
        ? nameById.get(String(r.step1_approved_by)) ?? ""
        : "";

    detailRows.push([
      nameById.get(sid) ?? sid,
      String(r.created_at ?? "").slice(0, 10),
      cat,
      amt,
      String(r.purpose ?? ""),
      appr,
      step2At || step1At,
    ]);
  }

  const summaryHeader = [
    "社員名",
    "交通費",
    "タクシー代",
    "宿泊費",
    "飲食費",
    "消耗品",
    "通信費",
    "その他",
    "合計",
  ];
  const summaryRows: (string | number)[][] = [summaryHeader];
  for (const [uid, a] of byUser) {
    const name = nameById.get(uid) ?? uid;
    const total =
      a.travel + a.taxi + a.lodging + a.meal + a.supplies + a.comm + a.other;
    summaryRows.push([
      name,
      a.travel,
      a.taxi,
      a.lodging,
      a.meal,
      a.supplies,
      a.comm,
      a.other,
      total,
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "経費サマリー");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "経費明細");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildIncentiveWorkbook(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  month: number,
  nameById: Map<string, string | null>,
  nameByDept: Map<string | null, string>,
) {
  const { data: deals } = await supabase
    .from("deals")
    .select(
      "id, salon_name, machine_type, sale_price, cost_price, deal_services, net_profit, payment_date, appo_employee_id, closer_employee_id, appo_incentive, closer_incentive, submit_status",
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .in("submit_status", ["submitted", "approved"]);

  type StaffAgg = { appoN: number; appoSum: number; closerN: number; closerSum: number };
  const agg = new Map<string, StaffAgg>();
  const detailRows: (string | number)[][] = [
    [
      "社員名",
      "サロン名",
      "商品",
      "販売価格",
      "実質原価",
      "サービス原価",
      "純利益",
      "役割",
      "インセンティブ",
      "入金日",
      "ステータス",
    ],
  ];

  function bump(id: string | null, role: "appo" | "closer", amount: number) {
    if (!id) return;
    if (!agg.has(id)) agg.set(id, { appoN: 0, appoSum: 0, closerN: 0, closerSum: 0 });
    const a = agg.get(id)!;
    if (role === "appo") {
      a.appoN++;
      a.appoSum += amount;
    } else {
      a.closerN++;
      a.closerSum += amount;
    }
  }

  for (const row of deals ?? []) {
    const r = row as Record<string, unknown>;
    const svc = sumDealServiceCosts(parseDealServices(r.deal_services));
    const payDate = r.payment_date ? String(r.payment_date).slice(0, 10) : "";
    const st = String(r.submit_status ?? "");
    const appoId = r.appo_employee_id ? String(r.appo_employee_id) : "";
    const closerId = r.closer_employee_id ? String(r.closer_employee_id) : "";
    const appoInc = Number(r.appo_incentive ?? 0);
    const closerInc = Number(r.closer_incentive ?? 0);

    if (appoId && appoInc > 0) {
      detailRows.push([
        nameById.get(appoId) ?? appoId,
        String(r.salon_name ?? ""),
        String(r.machine_type ?? ""),
        Number(r.sale_price ?? 0),
        Number(r.cost_price ?? 0),
        svc,
        Number(r.net_profit ?? 0),
        "アポ",
        appoInc,
        payDate,
        st,
      ]);
      bump(appoId, "appo", appoInc);
    }
    if (closerId && closerInc > 0) {
      detailRows.push([
        nameById.get(closerId) ?? closerId,
        String(r.salon_name ?? ""),
        String(r.machine_type ?? ""),
        Number(r.sale_price ?? 0),
        Number(r.cost_price ?? 0),
        svc,
        Number(r.net_profit ?? 0),
        "クローザー",
        closerInc,
        payDate,
        st,
      ]);
      bump(closerId, "closer", closerInc);
    }
  }

  const { data: profiles } = await supabase
    .from("employees")
    .select("id, name, department_id")
    .eq("company_id", companyId);

  const summaryRows: (string | number)[][] = [
    [
      "社員名",
      "部署",
      "アポ件数",
      "アポ合計",
      "クローザー件数",
      "クローザー合計",
      "合計インセンティブ",
    ],
  ];

  for (const p of (profiles ?? []) as ProfileRow[]) {
    const a = agg.get(p.id);
    if (!a) continue;
    const total = a.appoSum + a.closerSum;
    if (total <= 0 && a.appoN === 0 && a.closerN === 0) continue;
    summaryRows.push([
      p.name ?? p.id,
      nameByDept.get(p.department_id ?? "") ?? "",
      a.appoN,
      a.appoSum,
      a.closerN,
      a.closerSum,
      total,
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "インセンティブサマリー");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "案件明細");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
