/** フォールバック用（新規ユーザー初期 company など）。ログインユーザーの実 company は profiles.company_id を正とする。 */
export const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID?.trim() ??
  "00000000-0000-0000-0000-000000000001";
