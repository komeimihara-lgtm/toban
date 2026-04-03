export type SheetType = "sales_member" | "leader" | "member";

export type CheckItem = { category: string; item: string };

const SALES_NAMES = ["川津", "飯田", "小笠原"];
const LEADER_NAMES = ["中村 和彦", "大岩 龍喜", "後藤 裕美子", "中村", "大岩", "後藤"];

export function getSheetType(name: string): SheetType {
  const n = name.trim();
  if (SALES_NAMES.some((s) => n.includes(s))) return "sales_member";
  if (LEADER_NAMES.some((s) => n.includes(s))) return "leader";
  return "member";
}

export const SHEET_LABEL: Record<SheetType, string> = {
  sales_member: "営業メンバー用",
  leader: "リーダー・幹部用",
  member: "メンバー用",
};

export const SCORE_OPTIONS = [
  { value: 2, label: "2", desc: "これ以上なくやりきった・模範レベル" },
  { value: 1, label: "1", desc: "取り組んだがまだできる" },
  { value: -1, label: "-1", desc: "行動してみた" },
  { value: -2, label: "-2", desc: "意識していない" },
];

// --- メンバー用・営業メンバー用（18項目）---
const MEMBER_ITEMS: CheckItem[] = [
  { category: "プラス思考", item: "理念と使命を念頭においた行動を常にとっていたか？" },
  { category: "プラス思考", item: "1か月間、常に明るく・元気・素直・前向きであったか？" },
  { category: "向上心", item: "スキル向上のために自ら学びを率先して行なったか？（知識・技術・スキル・AI・自己啓発）" },
  { category: "向上心", item: "最善の答えと行動をとるために「報連相」をしながら業務を進めていたか？" },
  { category: "達成意欲", item: "決定しているKPI・KDIの達成を最優先で確実に遂行したか？" },
  { category: "達成意欲", item: "毎朝発表した行動目標・結果目標を必ず達成する日々であったか？有言実行" },
  { category: "達成意欲", item: "達成からの逆算として決めた月次計画を戦略的に1ヶ月間の業務をやりきったか？" },
  { category: "達成意欲", item: "朝の宣言と業務終了後の達成報告を確実に毎日行ったか？" },
  { category: "率先行動", item: "自分の得意分野に対してチームに対して手を差し伸べてチームに貢献ができたか？" },
  { category: "率先行動", item: "お客様・仲間・チームに対する想いをチームに発信して、有言実行ができたか？" },
  { category: "率先行動", item: "積極的に自己・チーム達成のためのアイデア・改善の提起と行動は取れたか？" },
  { category: "フォロー", item: "お客様対応は迅速・確実の対応で信頼と安心を得られたか？" },
  { category: "フォロー", item: "お客様からの質問・相談・要望・依頼に対して遅延や未対応なく、確実に処理を行ったか？" },
  { category: "フォロー", item: "全顧客に感動レベルのご満足いただけるフォローを心がけ、最善の対応したか？" },
  { category: "フォロー", item: "当社全社員のサポートのおかげと理解し、感謝と恩返しを行ったか？" },
  { category: "チームワーク", item: "自己管理の最優先として常に万全な体調の維持、健康管理に努めたか？" },
  { category: "規律", item: "社内ルールを守り、規律あるメリハリを持っていたか？" },
  { category: "規律", item: "全ての業務に対して、時間厳守・提出期限厳守ができたか？" },
];

// --- リーダー・幹部用（20項目）---
const LEADER_ITEMS: CheckItem[] = [
  { category: "プラス思考", item: "目的・使命感を常に失うことなく体現し、チームの活気を高める行動であったか？" },
  { category: "プラス思考", item: "会社の想い、ビジョン、方針、重点取り組みを常に全メンバーに伝え、理解を得たか？" },
  { category: "向上心", item: "自己の成長のための学びに対して自己投資を行なったか？その大切さをメンバーに伝えたか？" },
  { category: "向上心", item: "最善の答えと行動をとるため上長への報連相を自ら進んで行ったか？" },
  { category: "リーダーシップ", item: "チーム全体が活気に溢れるための旗振りをリーダーとして自ら率先して行ったか？" },
  { category: "リーダーシップ", item: "会社の方向性・チームとしての方針に沿って全員が足並みを揃った状態であったか？" },
  { category: "リーダーシップ", item: "使命を果たすことで成果が生まれる感動創造を自ら体現し、メンバーに理解を得たか？" },
  { category: "リーダーシップ", item: "チーム全体と各メンバーの状況を把握し月2回以上、面談・評価を確実に行ったか？" },
  { category: "チームワーク", item: "月初に決めた成長目標を元に、成長につながる取り組みをチーム・メンバーに行ったか？" },
  { category: "達成意欲", item: "チーム目標を絶対に達成する！メンバーを達成に導くという覚悟決断のある行動であったか？" },
  { category: "達成意欲", item: "決定しているKPI・KDIの達成を最優先で確実に遂行したか？" },
  { category: "達成意欲", item: "目標からの逆算として計画を戦略的にPDCAを回したか？" },
  { category: "達成意欲", item: "自ら決めた行動目標を必ず達成するで1日1日の成長・成果にこだわったか？" },
  { category: "率先行動", item: "月間のフォロー数を意識して、優先順位高く、フォローの取り組みを行うことができたか？" },
  { category: "フォロー", item: "全顧客に感動レベルの満足をいただけるフォローを心がけ、最善の対応したか？" },
  { category: "フォロー", item: "お客様からの質問・相談・要望・依頼に対して対応の遅延や未対応なく、毎日確実に処理を行ったか？" },
  { category: "フォロー", item: "月間のフォロー数を意識して、優先順位高く、フォローの取り組みを行うことができたか？" },
  { category: "規律", item: "提出物は期限を守り、漏れなく提出ができたか？またメンバーにその大切さを伝えたか？" },
  { category: "規律", item: "全ての業務に対して5分前行動にて時間厳守ができたか？またメンバーにその大切さを伝えたか？" },
  { category: "規律", item: "規律・ルール厳守・KDIの徹底をリーダーが厳しく管理を行なったか？" },
];

export function getItems(type: SheetType): CheckItem[] {
  return type === "leader" ? LEADER_ITEMS : MEMBER_ITEMS;
}

export function getMultiplier(type: SheetType, total: number): number {
  if (type === "leader") {
    if (total >= 36) return 1.2;
    if (total >= 28) return 1.1;
    if (total >= 20) return 1.0;
    if (total >= 12) return 0.9;
    return 0.8;
  }
  // member / sales_member
  if (total >= 34) return 1.2;
  if (total >= 29) return 1.1;
  if (total >= 18) return 1.0;
  if (total >= 10) return 0.9;
  return 0.8;
}

export function getMaxScore(type: SheetType): number {
  return type === "leader" ? 40 : 36;
}
