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

## ビジネスコンセプト
レナード株式会社の社内HR管理システム。
将来的にSaaS販売予定。
Layer1+2（完全無料）でユーザーを集め、
AIマッチング採用（月給5%継続課金）でマネタイズ。

---

## デザインシステム
実装の正は `src/app/globals.css`。ダークは **ログイン画面**（`src/app/login/page.tsx`）と同一トーン。

### ライト（:root）
- 背景 `#ffffff`、サイドバー/カードは `#f1f5f9` 系など（ファイル参照）

### ダーク（html.dark）
- **body 背景**: `linear-gradient(to bottom, #020617, #0c1222, #0f172a)`（slate-950 → #0c1222 → slate-900）
- **--background**: `#0c1222`
- **--background-sidebar / --surface-sidebar**: `#0f172a`
- **--card**: `#162033`
- **--border / --sidebar-border**: `#1e2d45`
- **--foreground**: `#f0f4ff` / **--muted-foreground**: `#94a3b8`
- **--accent**: `#2563eb` / **--sidebar-active-bg**: `#1d4ed8`
- ログインカード例: `bg-slate-900/50 backdrop-blur-md`

---

## ロール・権限
- owner: 三原孔明（全権限）
- director / approver / sr: 管理メニュー・承認など（`showAdminSection` は owner / director / approver / sr）
- staff: 一般社員（自分のデータ中心）
- **就業規則PDFの登録・AI学習・削除**: **owner / director のみ**（`/settings/documents`、API・RLS 同様）。approver はマイページで閲覧のみ（`/my/rules`）
- employees の `auth_user_id` で role を取得

---

## DBテーブル
- profilesテーブルは存在しない（全てemployeesテーブルを使用）
- auth_user_id = auth.uid() で照合
- phone, address, emergency_contact, job_title, line_user_id はemployeesテーブル
- **expenses**: `audit_score`, `audit_result`, `audit_at`, `auto_approved`（037 マイグレーション）
- **deals**: `payment_method`（text。UIは「現金・振込」「カード」「ローン」「その他」）
- **company_documents**: 就業規則PDF、`ai_summary`（Claude要約）、Storage `company-documents`
- **monthly_goals**: 月間目標・KPI（`theme`, `kpis` jsonb, `result_input` 等）
- **vehicles / vehicle_reservations**: 社用車・予約（039）

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
4. 給与明細 /my/payslip
5. 有給・休暇 /my/leave
6. インセンティブ申請 /my/incentive（対象者のみ）
7. AI相談窓口 /hr-ai
8. 月間目標 /my/goals
9. チェックシート /my/check-sheet
10. 成長履歴 /my/growth
11. 就業規則・社内規定 /my/rules（**閲覧のみ**。PDF一覧・プレビュー）
12. 契約内容 /my/contract
13. 社用車・予約 /my/vehicles（実装済みの場合）
14. プロフィール設定 /my/profile
15. 入社手続き /onboarding（onboarding_tasksにpendingがある場合）

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
10. 設定 /settings
11. 設定管理 /settings/tenant
12. 月次データ出力 /settings/export

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

### /my/vehicles（社用車）
- `vehicles` / `vehicle_reservations`（039）。会社単位で閲覧・予約。API: `/api/vehicles`, `/api/vehicle-reservations`

### /my/rules（就業規則・社内規定）
- **閲覧のみ**（PDF一覧・署名URLプレビュー）。アップロード・削除・AI学習は不可

### /settings/documents（就業規則管理）
- **owner / director のみ**。PDFアップロード、**AI学習**（`/api/company-documents/summarize`）、削除、学習済みバッジ

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

## 社員一覧・権限
三原 孔明 / mihara@lenard.jp / 代表取締役 / owner
千葉 亜矢子 / a.chiba@lenard.jp / 管理本部 / approver
三原 彩 / aya@lenard.jp / 管理本部 / approver
松田 剛 / matsuda@lenard.jp / 管理本部 / staff
中村 和彦 / nakamura@lenard.jp / サービス部 / staff（is_service_target=true）
橋本 賢一 / hashimoto@lenard.jp / サービス部 / staff（is_service_target=true）
田村 優平 / y.tamura@lenard.jp / サービス部 / staff（is_service_target=true）
髙橋 紀樹 / n.takahashi@lenard.jp / サービス部 / staff（is_service_target=true）
小山 智子 / t.koyama@lenard.jp / サービス部 / staff
吉田 浩 / h.yoshida@lenard.jp / サービス部 / staff
五島 久美子 / goshima@lenard.jp / 名古屋支社 / staff
藤野 由美佳 / fujino@lenard.jp / 名古屋支社 / staff
稲垣 祐佳 / inagaki@lenard.jp / 名古屋支社 / staff
川津 大輝 / kawazu@lenard.jp / 営業部 / staff（is_sales_target=true）
大岩 宏隆 / oiwa@lenard.jp / 福岡営業部 / staff（is_sales_target=true）
小笠原 啓太 / ogasawara@lenard.jp / 福岡営業部 / staff（is_sales_target=true）
飯田 有里 / iida@lenard.jp / 福岡営業部 / staff（is_sales_target=true）
後藤 / goto@lenard.jp / 本部長（契約） / staff（全対象外）
