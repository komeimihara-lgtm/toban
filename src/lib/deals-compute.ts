export const DEAL_MACHINE_TYPES = [
  "エイトキューブ",
  "バイマッハプロ",
  "バイマッハ",
  "バイマッハミニMAX",
  "エルフィーノ",
  "その他",
] as const;

export type DealMachineType = (typeof DEAL_MACHINE_TYPES)[number];

export type DealRoleRates = {
  appo: number;
  closer: number;
};

const FALLBACK_RATES: DealRoleRates = {
  appo: 0.04,
  closer: 0.04,
};

export type DealServiceLine = { name: string; cost: number };

/** API・フォームから deal_services JSONB へ正規化（空行は除く） */
export function normalizeDealServices(raw: unknown): DealServiceLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: DealServiceLine[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const costRaw = Number(o.cost);
    const cost = Number.isFinite(costRaw) ? costRaw : 0;
    if (!name && cost === 0) continue;
    out.push({ name, cost });
  }
  return out;
}

export function sumDealServiceCosts(services: DealServiceLine[] | null | undefined): number {
  if (!services?.length) return 0;
  return services.reduce((s, x) => s + (Number.isFinite(Number(x.cost)) ? Number(x.cost) : 0), 0);
}

/** 純利益 = 販売価格（税込）/ 1.1 − 実質原価 − サービス原価合計 */
export function computeNetProfit(
  salePriceTaxIn: number,
  costPrice: number,
  serviceCostsTotal = 0,
): number {
  const raw = salePriceTaxIn / 1.1 - costPrice - serviceCostsTotal;
  return Math.round(raw * 100) / 100;
}

export function ratesFromDbRows(rows: { role: string; rate: number | string }[] | null): DealRoleRates {
  const out = { ...FALLBACK_RATES };
  if (!rows?.length) return out;
  for (const r of rows) {
    const v = Number(r.rate);
    if (r.role === "appo") out.appo = v;
    else if (r.role === "closer") out.closer = v;
  }
  return out;
}

export function computeDealIncentives(
  netProfit: number,
  rates: DealRoleRates,
  opts: {
    appoEmployeeId: string | null | undefined;
    closerEmployeeId: string | null | undefined;
  },
) {
  const yen = (n: number) => Math.round(n);

  return {
    appo_incentive: opts.appoEmployeeId ? yen(netProfit * rates.appo) : 0,
    closer_incentive: opts.closerEmployeeId ? yen(netProfit * rates.closer) : 0,
  };
}

export function buildDealComputed(
  salePriceTaxIn: number,
  costPrice: number,
  machineRates: DealRoleRates,
  opts: Parameters<typeof computeDealIncentives>[2],
  serviceCostsTotal = 0,
) {
  const net_profit = computeNetProfit(salePriceTaxIn, costPrice, serviceCostsTotal);
  const inc = computeDealIncentives(net_profit, machineRates, opts);
  return { net_profit, ...inc };
}
