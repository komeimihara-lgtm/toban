# LENARD HR — 完全実装指示書
# このファイルを読んで「全て実装してください」と投げれば復元・再実装できます。

---

## プロジェクト情報
- パス: /Users/komeimihara/Dropbox/Mac/Desktop/lenard-hr
- GitHub: https://github.com/komeimihara-lgtm/lenard-hr.git
- 本番URL: https://lenard-hr-zaza.vercel.app
- Supabase: https://xpmyuihunrjtyagezokf.supabase.co
- 技術スタック: Next.js 14 App Router / TypeScript / Supabase / Tailwind CSS / Vercel

---

## ビジネスコンセプト
レナード株式会社の社内HR管理システム。
将来的にSaaS販売予定。
Layer1+2（完全無料）でユーザーを集め、
AIマッチング採用（月給5%継続課金）でマネタイズ。

---

## デザインシステム
- ダーク: warm グレー背景 + ネイビーサイドバー
- 背景: #161412 / カード: #1e1b17 / ボーダー: #2d2a26
- テキスト: #ffffff / サブテキスト: #d1d5db
- アクセント: #3b82f6（ブルー）
- セクションラベル: text-white
- サイドバー背景: #1a1f2e（ネイビー＋グレー）

---

## ロール・権限
- owner: 三原孔明（全権限・管理ダッシュ表示）
- approver: 千葉亜矢子・三原彩（承認権限・管理ダッシュ表示）
- staff: 一般社員（自分のデータのみ）

管理ダッシュボードはowner/approverのみ表示。
employeesテーブルのauth_user_idでroleを取得。

---

## DBテーブル
- profilesテーブルは存在しない（全てemployeesテーブルを使用）
- auth_user_id = auth.uid() で照合
- phone, address, emergency_contact, job_title, line_user_id はemployeesテーブル

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
6. AI相談窓口 /hr-ai
7. 契約内容 /my/contract
8. プロフィール設定 /my/profile
9. インセンティブ申請 /my/incentive（対象者のみ）
10. 入社手続き /onboarding（onboarding_tasksにpendingがある場合）

管理（owner/approverのみ）:
1. 管理ダッシュボード /
2. 承認 /approval
3. インセンティブ管理 /incentives
4. インセンティブ支給履歴 /incentives/history
5. 従業員管理 /employees
6. 経費審査 /expenses/audit
7. 経費・新規申請 /expenses/new
8. 経費・申請一覧 /expenses
9. 入退社手続き /onboarding/admin
10. 自動承認ルール /settings/auto-approval
11. 設定 /settings
12. 人事設定 /settings/hr
13. テナント・会社設定 /settings/tenant
14. 月次データ出力 /settings/export

---

## ページ仕様

### /my（マイページホーム）
- 「この面談の内容は外部には一切共有されません」
- 今日の打刻状況 + 出勤/退勤ボタン
- 有給残日数・次回付与日
- 今月の承認待ち経費件数・金額
- インセンティブ試算額（対象者のみ）
- お知らせ（承認完了・差戻し・有給付与通知）
- AI相談窓口クイックアクセス
- 今月の勤務時間サマリー

### /my/attendance（勤怠）
- 現在時刻リアルタイム表示
- 出勤/退勤ボタン（休憩は廃止・自動休憩控除）
- 自動休憩控除（労基法準拠）:
  6時間以下→控除なし / 6〜8時間→45分 / 8時間超→60分
- QRコード打刻（出勤用・退勤用）※5分で有効期限切れ
- 今月の勤怠カレンダー
- 打刻修正申請フォーム
- 今月のサマリー（出勤日数・実働時間・残業時間）

### /my/expenses（経費申請）
- 新規申請フォーム:
  金額・カテゴリ（交通費/タクシー/宿泊/飲食/消耗品/通信/書籍/広告/その他）
  日付・備考・領収書画像（Gemini Vision OCR）
- 申請一覧（ステータス別フィルター）
- 承認フロー表示

### /my/incentive（インセンティブ申請）
タブ1「案件登録」:
- 案件名・顧客名・販売価格・商品選択
- サービス内容 + サービス原価 + ×削除
- 純利益計算: 販売価格/1.1 - 実質原価 - サービス原価合計
- 役割選択（アポ/クローザー・ヒト幹は廃止）
- リアルタイム計算プレビュー
- 下書き保存/提出ボタン

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
- 社員の/my/payslipで閲覧・PDFダウンロード
- 新しい給与明細が届いたらLINE通知

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
