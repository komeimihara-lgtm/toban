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
) {
  const net_profit = computeNetProfit(salePriceTaxIn, costPrice);
  const inc = computeDealIncentives(net_profit, machineRates, opts);
  return { net_profit, ...inc };
}
