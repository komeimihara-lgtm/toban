/** UI・バリデーション用（CLAUDE.md / 楽楽精算移行仕様に合わせたカテゴリ） */
export const EXPENSE_CLAIM_KINDS = [
  { id: "expense", label: "経費精算", emoji: "🧾" },
  { id: "travel", label: "出張精算", emoji: "🚄" },
  { id: "advance", label: "仮払申請", emoji: "💴" },
  { id: "advance_settle", label: "仮払精算", emoji: "📋" },
] as const;

export type ExpenseClaimKindId = (typeof EXPENSE_CLAIM_KINDS)[number]["id"];

/** 経費カテゴリは会社ごとに expense_categories テーブルで管理（UI は DB から取得） */
