/** purpose から商談・訪問の件数ヒントを抽出 */

const DEAL_KEYWORDS =
  /商談|訪問|アポ|打[合合]せ|打ち合わせ|MTG|例会|提案|面談|商談会|顧客訪問/i;

const COUNT_PATTERNS: RegExp[] = [
  /(\d+)\s*[件社名箇]訪問/,
  /訪問\s*(\d+)/,
  /(\d+)\s*社/,
  /商談\s*(\d+)\s*件/,
  /(\d+)\s*件(?:の)?商談/,
  /打[合合]せ\s*(\d+)/,
  /(\d+)\s*回(?:の)?(?:訪問|商談|打[合合]せ)/,
  /(\d+)\s*件/,
];

export function hasDealKeywords(text: string) {
  return DEAL_KEYWORDS.test(text);
}

/** 数値が取れなければ null（AI フラグ用に hasDealKeywords と併用） */
export function parseDealCountFromPurpose(purpose: string): number | null {
  const t = purpose.trim();
  if (!t) return null;
  for (const re of COUNT_PATTERNS) {
    const m = t.match(re);
    if (m) return Math.max(0, Number(m[1]));
  }
  return null;
}

export function parseNightsFromPurpose(purpose: string): number | null {
  const m = purpose.match(/(\d+)\s*泊/);
  if (m) return Math.max(1, Number(m[1]));
  return null;
}
