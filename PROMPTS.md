# LENARD HR — 完全実装指示書
# このファイルを読んで「全て実装してください」と投げれば復元・再実装できます。

---

## プロジェクト情報
- パス: /Users/komeimihara/Dropbox/Mac/Desktop/lenard-hr
- GitHub: https://github.com/komeimihara-lgtm/lenard-hr.git
- 本番URL: https://lenard-hr-zaza.vercel.app
- Supabase: https://xpmyuihunrjtyagezokf.supabase.co
- 技術スタック: Next.js App Router（16系） / TypeScript / Supabase / Tailwind CSS / Vercel
- AI: Anthropic（就業規則PDF要約・経費監査・HR-AI 等）／Gemini Vision（OCR）

---

## 追加された機能（最新実装の要点）

| 領域 | パス・内容 |
|------|------------|
| **社用車（設備）予約** | `/my/vehicles` … 全員が予約・閲覧。`/settings/vehicles` … **owner / director のみ**（車両マスタの追加・編集・無効化）。DB: `vehicles`, `vehicle_reservations`（**039**） |
| **自己管理** | `/my/self-management` … 月間目標・黄金ルール評価表・成長履歴への**自己管理ハブ**（各機能への集約ページ。**未実装時は** `/my/goals`・`/my/check-sheet`・`/my/growth` を直接利用） |
| **就業規則** | `/my/rules` … **閲覧のみ**（PDF・署名URL）。`/settings/documents` … **owner / director のみ**（アップロード・AI要約・削除） |
| **黄金ルール評価表** | `/my/check-sheet` … DB `check_sheets`。種別は氏名により自動判定（`sheet-definitions.ts`）: **メンバー用** / **営業メンバー用**（川津・飯田・小笠原） / **リーダー・幹部用**。承認側は `/approval` のチェックシート枠 |
| **月間目標・KPI・査定** | `/my/goals` … `monthly_goals`（theme, kpis jsonb, 承認フロー, AI評価）。成長: `/my/growth`。査定: `performance_reviews`（マイグレーション 031 等） |

---

## ビジネスコンセプト
レナード株式会社の社内HR管理システム。
将来的にSaaS販売予定。
Layer1+2（完全無料）でユーザーを集め、
AIマッチング採用（月給5%継続課金）でマネタイズ。

---

## デザインシステム
実装の正は `src/app/globals.css`。ダークは **ログイン画面**（`src/app/login/page.tsx`）と同一トーン。

### カラー設計（確定版・ダークの核）
- **background**: `#0c1222`（`--background`）
- **background-sidebar**: `#0f172a`（`--background-sidebar` / `--surface-sidebar`）
- **card**: `#162033`（`--card`）
- **accent**: `#2563eb`（`--accent`。アクティブ寄りは `--sidebar-active-bg: #1d4ed8`）

### ライト（:root）
- 背景 `#ffffff`、サイドバー/カードは `#f1f5f9` 系など（ファイル参照）

### ダーク（html.dark）
- **body 背景**: `linear-gradient(to bottom, #020617, #0c1222, #0f172a)`（slate-950 → 上記 background → slate-900）
- **--background**: `#0c1222`
- **--background-sidebar / --surface-sidebar**: `#0f172a`
- **--card**: `#162033`
- **--border / --sidebar-border**: `#1e2d45`
- **--foreground**: `#f0f4ff` / **--muted-foreground**: `#94a3b8`
- **--accent**: `#2563eb` / **--sidebar-active-bg**: `#1d4ed8`
- ログインカード例: `bg-slate-900/50 backdrop-blur-md`

---

## ロール体系（DB: employees.role）
| role | 想定担当 | 主な権限・表示 |
|------|----------|----------------|
| **owner** | 三原孔明 | 全権限 |
| **director** | 三原彩 | 管理メニュー。給与・退職リスク等 **salary/retention 系の閲覧**（`isSalaryAllowed` / `isRetentionAllowed`）。就業規則**管理**（`/settings/documents`） |
| **approver** | 千葉亜矢子 | 経費・有給など**第1承認**、管理ダッシュ表示。**給与明細・契約等は非表示**（スタッフ同等の給与 UI 制約を意図した運用） |
| **leader** | 五島久美子 | **チェックシート（黄金ルール）評価のみ**（承認ページの評価枠。sidebar は `showCheckSheetApproval` 等で調整） |
| **sr** | 社労士（社外アカウント想定） | 給与・雇用契約の閲覧。管理セクション表示 |
| **staff** | 一般社員 | 自分のデータ中心 |

- 管理サイドバー（一覧が広いナビ）: **owner / director / approver / sr**（`showAdminSection`）
- **就業規則 PDF の登録・AI 学習・削除**: **owner / director のみ**（`/settings/documents`、API・Storage RLS 同様）
- employees の `auth_user_id`（または一部レガシーで `user_id`）で role を取得

### 評価担当（manager_id 想定・組織ルール）
メンバーの上長評価・チェックシートまわりで参照する担当イメージ（実装は `employees.manager_id` 等で紐付け）:

| 評価者 | 管下 |
|--------|------|
| **中村 和彦** | サービス部メンバー **5 名**（高橋・田村・橋本・小山・吉田 等、定義に従う） |
| **大岩 龍喜** | 営業 **3 名**（川津・小笠原・飯田） |
| **五島 久美子** | 名古屋 **2 名**（藤野・稲垣） |
| **三原 彩** | 管理本部 **3 名**（千葉・松田・三原彩自身を除く構成など、定義に従う） |
| **三原 孔明** | **中村・大岩・五島・後藤**（幹部ライン） |

---

## DBテーブル・マイグレーション
- **マイグレーション**: `supabase/migrations` は **`039_vehicle_reservations.sql` まで** コミット済み。**本番・開発 DB では 039 まで適用済み**を前提にドキュメントを更新する（新環境は CLI で一括適用）
- profilesテーブルは存在しない（全てemployeesテーブルを使用）
- auth_user_id = auth.uid() で照合
- phone, address, emergency_contact, job_title, line_user_id はemployeesテーブル
- **expenses**: `audit_score`, `audit_result`, `audit_at`, `auto_approved`（037 マイグレーション）
- **deals**: `payment_method`（text。UIは「現金・振込」「カード」「ローン」「その他」）
- **company_documents**: 就業規則PDF、`ai_summary`（Claude要約）、Storage `company-documents`
- **monthly_goals**: 月間目標・KPI（`theme`, `kpis` jsonb, `result_input` 等）
- **vehicles / vehicle_reservations**: 社用車・予約（**039**）
- **check_sheets**: 黄金ルール評価（ self_check / manager_check jsonb 等）
- **performance_reviews**: 査定（期間・スコア・AIサマリー等、031 付近）

---

## 承認フロー
千葉亜矢子（第1承認）→ 三原孔明（最終承認）
全拠点共通。

---

## サイドバーメニュー

マイページ（全員）:
1. ホーム /my
2. 勤怠 /my/attendance
3. 経費申請 /my/expenses
4. 給与明細 /my/payslip（**approver は運用上フィルタ可**・要件に合わせ非表示）
5. 有給・休暇 /my/leave
6. 社用車予約 /my/vehicles
7. インセンティブ申請 /my/incentive（対象者のみ）
8. AI相談窓口 /hr-ai
9. **自己管理** `/my/self-management`（目標・評価表・成長のハブ。未実装時は以下個別へ）
10. 月間目標 /my/goals
11. 黄金ルール評価表（チェックシート）/my/check-sheet
12. 成長履歴 /my/growth
13. 就業規則・社内規定 /my/rules（**閲覧のみ**）
14. 契約内容 /my/contract
15. プロフィール設定 /my/profile
16. 入社手続き /onboarding（条件付き）

管理（owner / director / approver / sr）:
1. 管理ダッシュボード /
2. ワークフロー承認 /approval
3. インセンティブ管理 /incentives（タブ: 計算・提出 / 支給履歴）
4. 従業員管理 /employees
5. 経費削減レポート /expenses/audit
6. 経費・申請一覧 /expenses
7. 入退社手続き /onboarding/admin
8. 自動承認ルール /settings/auto-approval
9. **就業規則管理 /settings/documents**（**owner / director のみ**）
10. **車両管理 /settings/vehicles**（**owner / director のみ**）
11. 設定 /settings
12. 設定管理 /settings/tenant
13. 月次データ出力 /settings/export

---

## ページ仕様

### /my（マイページホーム）
- 今日の打刻状況 + **PunchButtons**（出勤/退勤）
- **今月の目標**カード（`monthly_goals`・KPIプログレスバー、未設定時は /my/goals へ誘導）
- 有給残日数・次回付与日
- 今月の承認待ち経費件数・金額
- 給与明細サマリー（payslip_cache）
- インセンティブ試算額（対象者のみ）
- お知らせ（承認完了・差戻し・有給付与通知）
- 今月の勤務時間サマリー
- AI人事チャットへのリンク

### /my/attendance（勤怠）
- **1カード内**: 位置情報ステータス + **コンパクトな現在時刻（Asia/Tokyo）** + 大型出退勤タイル
- 出勤/退勤（休憩手動打刻は廃止・自動休憩控除）
- 本日タイムライン・今月勤務サマリー（ダークカード UI）
- QR打刻・月次カレンダー・打刻修正申請はページ内リンクから

### /my/expenses（経費申請・一覧）
- 見出し「経費申請」→ **レシート撮影**大ボタン（/my/expenses/new）→ **申請状況** → フィルタ（全件・下書き・第1承認待ち・最終承認待ち・承認済・差戻し）+ CSV → 一覧
- 新規: OCR・種別・カテゴリ等
- DB: AI監査列（`audit_score` 等）

### /my/payslip（給与明細）
- 説明文は最小。`FREEE_COMPANY_ID` 未設定時は「給与明細は準備中です。」（詳細エラーを出さない）

### /my/self-management（自己管理）
- 月間目標・黄金ルール評価表・成長履歴への**入口**（カード／リンクのハブ）。ルート未作成環境では `/my/goals`・`/my/check-sheet`・`/my/growth` を利用

### /my/vehicles（社用車）
- `vehicles` / `vehicle_reservations`（**039**）。全員が予約。API: `/api/vehicles`, `/api/vehicle-reservations`, `/api/vehicle-reservations/[id]`

### /settings/vehicles（車両管理）
- **owner / director のみ**。社用車マスタの CRUD（`VehicleAdminClient`）

### /my/rules（就業規則・社内規定）
- **閲覧のみ**（PDF一覧・署名URLプレビュー）。アップロード・削除・AI学習は不可

### /settings/documents（就業規則管理）
- **owner / director のみ**。PDFアップロード、**AI学習**（`/api/company-documents/summarize`）、削除、学習済みバッジ

### /my/goals・査定連携
- **月間目標・KPI**: `monthly_goals`（提出・承認・結果入力・Claude による AI 評価 `/api/goals/evaluate`）
- **成長履歴** `/my/growth`: `monthly_goals` / `check_sheets` の履歴表示
- **査定** `performance_reviews`: 期間・総合スコア・レビューコメント等（管理・入力画面は拡張可能）

### /my/incentive（インセンティブ申請）
タブ1「案件登録」:
- サロン名の下に **支払い方法**（現金・振込 / カード / ローン / その他）の4ボタン選択 → `deals.payment_method` に保存
- 商品マスタ・販売価格・実質原価・サービス原価行
- 純利益・インセン試算プレビュー
- 役割（アポ/クローザー）
- 下書き保存/提出

タブ2「マイ実績」:
- 提出済み案件一覧・ステータス
- 月間インセンティブ合計

タブ3「履歴」:
- 過去12ヶ月の月別集計

### /my/contract（契約内容）
- 基本給・みなし残業・通勤費（読み取り専用）
- 入社日・試用期間終了日
- 次回有給付与日・付与予定日数

### /my/profile（プロフィール設定）
- 氏名・電話番号・住所・緊急連絡先・LINE ID（編集可）
- 入社日・部署・役職（読み取り専用）
- パスワード変更

### /dashboard（管理ダッシュボード）
- KPI4枚（今月経費合計/承認待ち件数/インセンティブ試算/自動承認率）
- 要対応アクション
- 本日のスタッフ出勤状況一覧
- 退職リスクアラート

### /approval（承認）
- 経費承認・インセンティブ承認
- 承認/差戻し（差戻し理由必須）
- 差戻し時LINE通知

### /incentives（インセンティブ管理）
- 全社員のインセンティブ一覧
- 月別集計・承認

### /employees（従業員管理）
- 社員一覧・編集
- ロール変更・フラグ設定（is_sales_target/is_service_target）

---

## インセンティブ計算

純利益 = 販売価格 ÷ 1.1（税抜） - 実質原価 - サービス原価合計
ユーザーインセンティブ = 純利益 × 同率
ヒト幹は廃止・存在しない

率（deal_incentive_rates）:
エイトキューブ: アポ5% / クローザー5%
その他全商品: アポ4% / クローザー4%

---

## 商品マスタ
エイトキューブ: ¥75,000
バイマッハプロ: ¥1,350,000
バイマッハ新品: ¥900,000
バイマッハミニ: ¥800,000
バイマッハミニMAX: ¥800,000
エルフィーノ: ¥800,000
バイマッハ中古: ¥700,000
マグニート: ¥750,000

---

## 退職リスクアラート
高リスク（red）:
- 有給を連続5日以上申請
- 遅刻・欠勤が月3回以上
- インセンティブが前月比50%以上減少
- 営業スタッフの案件登録が2ヶ月連続ゼロ
- AI相談で「辞めたい」「転職」「限界」「退職」を検知

中リスク（yellow）:
- 有給取得が先月比200%以上に急増
- 残業時間が先月比50%以上急減
- インセンティブが3ヶ月連続減少
- 月後半の交通費・タクシー代が急増

---

## freee連携
- freee人事労務 API v1
- OAuth認証（コールバック: /api/freee/callback）
- 毎月25日09:00 UTCに給与明細を自動同期
- 社員の/my/payslipで閲覧・印刷
- 新しい給与明細が届いたらLINE通知

## AI相談（HR-AI）
- `company_documents.ai_summary` をシステムプロンプトに注入（就業規則ベース回答）
- 従業員の契約・勤怠・有給等のサマリーをプロンプトに含む実装あり（`src/lib/hr-ai-build-prompt.ts`）

---

## 社員一覧・権限（ロールは運用で DB に反映すること）
三原 孔明 / mihara@lenard.jp / 代表取締役 / **owner**
千葉 亜矢子 / a.chiba@lenard.jp / 管理本部 / **approver**（給与・契約は原則不要表示）
三原 彩 / aya@lenard.jp / 管理本部 / **director**（給与・退職リスク閲覧・就業規則管理）
松田 剛 / matsuda@lenard.jp / 管理本部 / staff
中村 和彦 / nakamura@lenard.jp / サービス部 / staff（is_service_target=true・**サービス部評価担当**）
橋本 賢一 / hashimoto@lenard.jp / サービス部 / staff（is_service_target=true）
田村 優平 / y.tamura@lenard.jp / サービス部 / staff（is_service_target=true）
髙橋 紀樹 / n.takahashi@lenard.jp / サービス部 / staff（is_service_target=true）
小山 智子 / t.koyama@lenard.jp / サービス部 / staff
吉田 浩 / h.yoshida@lenard.jp / サービス部 / staff
五島 久美子 / goshima@lenard.jp / 名古屋支社 / **leader**（黄金ルール評価・名古屋2名の上長イメージ）
藤野 由美佳 / fujino@lenard.jp / 名古屋支社 / staff
稲垣 祐佳 / inagaki@lenard.jp / 名古屋支社 / staff
川津 大輝 / kawazu@lenard.jp / 営業部 / staff（is_sales_target=true）
大岩 宏隆（龍喜表記あり） / oiwa@lenard.jp / 福岡営業部 / staff（is_sales_target=true・**営業3名の評価担当**）
小笠原 啓太 / ogasawara@lenard.jp / 福岡営業部 / staff（is_sales_target=true）
飯田 有里 / iida@lenard.jp / 福岡営業部 / staff（is_sales_target=true）
後藤 / goto@lenard.jp / 本部長（契約） / staff（全対象外）

※ **sr**（社労士）は別アカウントで付与する想定。メールは運用で追記。
