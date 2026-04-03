# LENARD HR — Claude Code 実装プロンプト集
# Cursorのターミナルで `claude` を起動後、以下を順番に貼り付けてください

## メンテナンス用の正（2026年以降）
- **画面一覧・権限・配色・DBの要点**: リポジトリ直下の **`PROMPTS.md`**（ここより優先して参照）
- **ダークテーマ CSS 変数・body グラデーション**: `src/app/globals.css`（ログイン画面と同系: slate-950 → `#0c1222` → slate-900）
- **会社固有情報・承認フロー**: `CLAUDE.md`

# ============================================================
# STEP 0: CLAUDE.md（プロジェクト仕様書）を作成
# ターミナルで実行:
# cat > CLAUDE.md << 'SPEC'
# ============================================================

LENARD HR — プロジェクト仕様書

## 会社情報
- 会社名: レナード株式会社
- 代表: 三原 孔明（最終承認者・全申請の最終承認）
- チーム: 後藤・大岩・小笠原・飯田・川津・五島・中村（約8名）
- 部門: 営業部・CS部・サービス部・名古屋支社（など複数）

## システム概要
楽楽精算から完全移行するHRシステム。
経費精算・インセンティブ計算・承認ワークフローを一元管理。

## 経費精算
### 申請種別
1. 経費精算（通常の領収書）
2. 出張精算（交通費＋宿泊費）
3. 仮払申請
4. 仮払精算

### 承認フロー（2段階）
申請者 → 部門長（第1承認）→ 三原孔明（最終承認）→ 完了

### 部門長の管理
- 3名以上（設定画面で管理）
- 部門単位で担当を分ける（営業部の申請→営業部長が第1承認、など）
- 部門長はDBで管理し、画面から追加・変更可能

### 差戻し
- 差戻し理由を必須入力
- 申請者にLINE or メール通知
- 再申請フローあり

## インセンティブ
### 対象
- 現状: 営業部のみ
- 将来: 部門ごとに設定できる拡張構造

### 計算式
- 月間売上実績 × 個人設定率（スタッフごとに異なる率）
- 率は設定画面で月ごとに変更可能（流動的）
- 計算式タイプ: 今後「段階式」「目標超過別率」も追加予定

### 月次フロー
1. 月末に売上データを入力（or kintone/freee会計から取得）
2. インセンティブ自動試算
3. 部門長が確認・提出
4. 三原孔明が最終承認
5. freee人事労務APIに送信 → 翌月給与に反映

## 技術スタック
- Next.js App Router + TypeScript（実装は 16 系ビルド想定。詳細は `package.json` / `PROMPTS.md`）
- Supabase（PostgreSQL + Row Level Security）
- freee 人事労務 API v1
- Tailwind CSS + shadcn/ui
- Vercel（デプロイ + Cron Jobs）
- Gemini Vision API（領収書OCR）

## 環境変数
FREEE_CLIENT_ID=
FREEE_CLIENT_SECRET=
FREEE_REDIRECT_URI=http://localhost:3000/api/freee/callback
FREEE_COMPANY_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CRON_SECRET=lenard-cron-2025
LINE_CHANNEL_ACCESS_TOKEN=

# ============================================================
# STEP 1: Claude Codeに最初に渡すプロンプト（型定義 + DB設計）
# claude を起動後、以下をそのまま貼り付け
# ============================================================

CLAUDE.mdを読んで、以下のファイルを作成してください。

**1. src/types/index.ts**

以下の型を全て定義:

```typescript
// 部門
export type Department = {
  id: string
  name: string           // "営業部" | "CS部" | "サービス部" | "名古屋支社"
  manager_employee_id: string  // 部門長のemployee_id
  incentive_enabled: boolean   // インセンティブ対象か
  created_at: string
}

// 従業員
export type Employee = {
  id: string
  name: string
  department_id: string
  role: 'owner' | 'manager' | 'staff'  // owner=三原孔明, manager=部門長, staff=一般
  email: string
  line_user_id?: string
  is_active: boolean
}

// 経費申請
export type ExpenseType = 'expense' | 'travel' | 'advance' | 'advance_settle'
export type ExpenseStatus = 'draft' | 'step1_pending' | 'step2_pending' | 'approved' | 'rejected'

export type Expense = {
  id: string
  type: ExpenseType
  status: ExpenseStatus
  submitter_id: string
  submitter_name: string
  department_id: string
  category: ExpenseCategory
  amount: number
  paid_date: string
  vendor: string
  purpose: string
  attendees?: string
  from_location?: string    // 交通費・出張
  to_location?: string
  receipt_url?: string
  rejection_reason?: string
  step1_approved_by?: string
  step1_approved_at?: string
  step2_approved_by?: string
  step2_approved_at?: string
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | '交通費'
  | '接待交際費'
  | '通信費'
  | '消耗品費'
  | '書籍・研修費'
  | '広告宣伝費'
  | '出張費（交通）'
  | '出張費（宿泊）'
  | 'その他'

// インセンティブ設定（月次）
export type IncentiveConfig = {
  id: string
  year: number
  month: number
  department_id: string    // 現状は営業部のみ
  employee_id: string
  employee_name: string
  sales_amount: number     // 月間売上実績
  rate: number             // 率（%）例: 3.0
  incentive_amount: number // 計算結果 = sales_amount * rate / 100
  status: 'draft' | 'submitted' | 'step1_approved' | 'final_approved' | 'paid'
  notes?: string
}

// 承認ログ
export type ApprovalLog = {
  id: string
  target_type: 'expense' | 'incentive'
  target_id: string
  action: 'step1_approve' | 'step2_approve' | 'reject'
  actor_id: string
  actor_name: string
  reason?: string
  created_at: string
}
```

**2. supabase/migrations/001_initial.sql**

以下のテーブルを全て作成するSQLを書いてください:

- departments（部門）
- employees（従業員 - Supabase Authと連携）
- expenses（経費申請）
- expense_items（明細行 - 1申請に複数明細対応）
- incentive_configs（インセンティブ設定・月次）
- approval_logs（承認ログ）
- freee_tokens（freee OAuthトークン）
- notification_queue（LINE/メール通知キュー）

RLSポリシーも設定:
- 一般スタッフ: 自分の申請のみ閲覧・作成
- 部門長: 自部門の申請を閲覧・第1承認
- owner（三原孔明）: 全件閲覧・最終承認

初期データ（seed）:
- departments: 営業部・CS部・サービス部・名古屋支社
- employees: 三原孔明（owner）・後藤・大岩・小笠原・飯田・川津・五島・中村

# ============================================================
# STEP 2: API Routes
# ============================================================

CLAUDE.mdと src/types/index.ts を読んで、以下のAPIを実装してください。

**src/app/api/expenses/route.ts** (GET, POST)
- GET: クエリパラメータでフィルタ（status, department_id, submitter_id, year, month）
- POST: 新規申請作成（draft or 即提出）
- バリデーション: amount > 0, purpose必須, paid_date必須

**src/app/api/expenses/[id]/route.ts** (GET, PATCH, DELETE)
- PATCH: ステータス更新（承認・差戻し・編集）
- DELETE: draft状態のみ削除可能

**src/app/api/expenses/[id]/approve/route.ts** (POST)
- 部門長による第1承認: status を step1_pending → step2_pending に変更
- 代表による最終承認: status を step2_pending → approved に変更
- 承認ログを approval_logs に保存
- 承認後、次の承認者にLINE通知（notification_queueに追加）

**src/app/api/expenses/[id]/reject/route.ts** (POST)
- reason必須
- status を rejected に変更
- 申請者にLINE通知

**src/app/api/incentives/route.ts** (GET, POST)
- GET: 月・部門でフィルタ（department_id=営業部固定）
- POST: インセンティブ設定の保存・提出

**src/app/api/incentives/calculate/route.ts** (POST)
- body: { year, month, department_id }
- 各スタッフの sales_amount × rate を計算
- 結果を incentive_configs に upsert して返す

**src/app/api/incentives/[id]/approve/route.ts** (POST)
- 2段階承認（expenses/approveと同じロジック）
- 最終承認後: freee人事労務APIに連携（src/lib/freee-hr.tsを使用）

**src/app/api/settings/departments/route.ts** (GET, POST, PATCH)
**src/app/api/settings/incentive-rates/route.ts** (GET, POST)
- 月次インセンティブ率の設定

# ============================================================
# STEP 3: UI コンポーネント
# ============================================================

CLAUDE.mdを読んで、以下のコンポーネントを作成してください。

**src/components/expense/ExpenseForm.tsx**
- 領収書アップロードゾーン（Gemini OCR連携 or モック）
- 申請種別の選択（4種類）
- フォームフィールド全て
- 承認フロー表示（申請者→部門長→三原孔明）
- 消費税の自動計算表示

**src/components/expense/ExpenseList.tsx**
- ステータスフィルター
- 各行クリックで詳細モーダル

**src/components/approval/ApprovalCard.tsx**
- 2段階フロー表示（ステッパーUI）
- 承認ボタン・差戻しボタン
- 差戻し時は理由入力モーダル
- 領収書サムネイル表示

**src/components/incentive/IncentiveCalculator.tsx**
- 営業部メンバー一覧
- 売上入力フィールド（月次）
- 率の表示（設定から取得）
- インセンティブ自動計算・合計表示
- 提出ボタン → 承認フロー開始

**src/components/incentive/IncentiveSettings.tsx**
- 営業部メンバーの管理（追加・削除）
- 各メンバーの率設定（月次で変更可能）
- 「来月も同じ設定を使う」コピーボタン

**src/components/layout/Sidebar.tsx**
- 経費精算: ダッシュボード・新規申請・申請一覧・承認
- インセンティブ: 計算・提出、設定、支給履歴
- 承認バッジ（未承認件数）
- インセンティブ未提出バッジ

# ============================================================
# STEP 4: ページ
# ============================================================

以下のページを作成してください。

**src/app/(app)/layout.tsx**
- Sidebarを含む共通レイアウト
- 認証チェック（Supabase Auth）

**src/app/(app)/page.tsx** （ダッシュボード）
- KPI: 今月の経費合計・承認待ち件数・インセンティブ試算額
- 要対応リスト（承認待ち・未提出インセンティブ）
- 最近の申請一覧
- カテゴリ別棒グラフ

**src/app/(app)/expenses/new/page.tsx**
- ExpenseFormコンポーネントを使用

**src/app/(app)/expenses/page.tsx**
- ExpenseListコンポーネント
- CSVエクスポート機能

**src/app/(app)/approval/page.tsx**
- 自分の承認権限に応じて表示を切り替え
  - 部門長: 自部門の step1_pending を表示
  - 代表(三原孔明): step2_pending を表示 + step1_pendingも閲覧可
- ApprovalCardコンポーネントを使用
- 一括承認ボタン

**src/app/(app)/incentives/page.tsx**
- IncentiveCalculatorコンポーネント
- 今月の営業部メンバーと売上入力
- 試算→提出フロー

**src/app/(app)/incentives/history/page.tsx**
- 月別推移グラフ
- 支給履歴テーブル

**src/app/(app)/settings/page.tsx**
- 部門管理（追加・編集）
- 部門長の設定
- IncentiveSettingsコンポーネント
- 承認フロー設定

# ============================================================
# STEP 5: freee連携 + 通知
# ============================================================

以下のファイルを作成してください。

**src/lib/freee-hr.ts**
以下の関数を実装:
- getAccessToken(): Supabaseからトークン取得、期限切れなら自動更新
- fetchPayrollStatements(year, month): 給与明細一覧
- fetchWorkRecordSummary(employeeId, year, month): 勤怠サマリー（残業・有給）
- postIncentiveToSalary(employeeId, amount, month): インセンティブを追加手当として登録

**src/lib/notifications.ts**
以下の関数を実装:
- notifyLineUser(userId, message): LINE Messaging API
- notifyApprovalRequest(expense): 承認依頼通知
- notifyApproved(expense): 承認完了通知  
- notifyRejected(expense, reason): 差戻し通知
- notifyIncentiveSubmitted(config): インセンティブ提出通知

**src/app/api/cron/sync-freee/route.ts**
- 毎月25日 09:00 実行（vercel.json設定も）
- 全スタッフの給与明細をSupabaseにキャッシュ
- 有給残日数・勤怠データも同時取得

# ============================================================
# STEP 6: vercel.json
# ============================================================

vercel.jsonを作成してください:
{
  "crons": [
    { "path": "/api/cron/sync-freee", "schedule": "0 9 25 * *" },
    { "path": "/api/cron/process-notifications", "schedule": "*/5 * * * *" }
  ]
}

# ============================================================
# 実装時の注意点（Claude Codeへの指示）
# ============================================================

1. 型安全: any禁止、全てに型をつける
2. エラーハンドリング: 全APIにtry-catchとエラーレスポンス
3. RLS: Supabaseのサーバーサイドクライアントを使用
4. 承認権限チェック: APIレベルで役割確認
5. インセンティブは営業部のみ: department.incentive_enabled === true のみ計算対象
6. 率の管理: incentive_ratesテーブルで year, month, employee_id ごとに管理（毎月変更可能）
7. 将来拡張: 計算式タイプ（'fixed_rate' | 'tiered' | 'above_target'）をDBに持たせる
