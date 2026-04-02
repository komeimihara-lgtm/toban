export const DEAL_MACHINE_TYPES = [
  "エイトキューブ",
  "バイマッハプロ",
  "エルフィーノ",
  "バイマッハ",
  "バイマッハミニMAX",
] as const;

export type DealMachineType = (typeof DEAL_MACHINE_TYPES)[number];

export type DealRoleRates = {
  appo: number;
  closer: number;
  hito: number;
};

const FALLBACK_RATES: DealRoleRates = {
  appo: 0.04,
  closer: 0.04,
  hito: 0.08,
};

export function computeNetProfit(salePriceTaxIn: number, costPrice: number): number {
  const raw = salePriceTaxIn / 1.1 - costPrice;
  return Math.round(raw * 100) / 100;
}

export function ratesFromDbRows(rows: { role: string; rate: number | string }[] | null): DealRoleRates {
  const out = { ...FALLBACK_RATES };
  if (!rows?.length) return out;
  for (const r of rows) {
    const v = Number(r.rate);
    if (r.role === "appo") out.appo = v;
    else if (r.role === "closer") out.closer = v;
    else if (r.role === "hito") out.hito = v;
  }
  return out;
}

export function computeDealIncentives(
  netProfit: number,
  rates: DealRoleRates,
  opts: {
    appoEmployeeId: string | null | undefined;
    closerEmployeeId: string | null | undefined;
    hitoEmployeeId: string | null | undefined;
    hitoBottles: number | null | undefined;
  },
) {
  const bottleMult =
    opts.hitoEmployeeId != null
      ? Math.max(1, opts.hitoBottles == null || opts.hitoBottles < 1 ? 1 : opts.hitoBottles)
      : 1;

  const yen = (n: number) => Math.round(n);

  return {
    appo_incentive: opts.appoEmployeeId ? yen(netProfit * rates.appo) : 0,
    closer_incentive: opts.closerEmployeeId ? yen(netProfit * rates.closer) : 0,
    hito_incentive: opts.hitoEmployeeId ? yen(netProfit * rates.hito * bottleMult) : 0,
  };
}

export function buildDealComputed(
  salePriceTaxIn: number,
  costPrice: number,
  machineRates: DealRoleRates,
  opts: Parameters<typeof computeDealIncentives>[2],
) {
  const net_profit = computeNetProfit(salePriceTaxIn, costPrice);
  const inc = computeDealIncentives(net_profit, machineRates, opts);
  return { net_profit, ...inc };
}
