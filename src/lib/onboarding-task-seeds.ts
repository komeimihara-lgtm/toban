export type OnboardingTaskSeed = {
  task_type:
    | "contract"
    | "my_number"
    | "bank_account"
    | "commute_route"
    | "emergency_contact"
    | "health_insurance"
    | "pension"
    | "equipment";
  title: string;
  description: string;
};

export const ONBOARDING_TASK_SEEDS: OnboardingTaskSeed[] = [
  {
    task_type: "contract",
    title: "雇用契約書の確認・署名",
    description: "雇用条件通知書・労働条件通知、契約書面の確認と e 署名・返送（原本指示に従う）",
  },
  {
    task_type: "my_number",
    title: "マイナンバー提出",
    description: "個人番号の提出（提出方法は人事からの案内に従ってください）",
  },
  {
    task_type: "bank_account",
    title: "給与振込口座の登録",
    description: "通帳コピー等、指定フォーマットでの口座登録",
  },
  {
    task_type: "commute_route",
    title: "通勤経路の登録",
    description: "最寄駅からの経路・定期券情報（通勤手当の算定に使用）",
  },
  {
    task_type: "emergency_contact",
    title: "緊急連絡先の登録",
    description: "家族・緊急連絡先の氏名・続柄・電話番号",
  },
  {
    task_type: "health_insurance",
    title: "健康保険・厚生年金の加入手続き",
    description: "被扶養者の有無、初任事務のための書類提出",
  },
  {
    task_type: "pension",
    title: "年金手帳・基礎年金番号の確認",
    description: "番号判明が難しい場合は人事に相談",
  },
  {
    task_type: "equipment",
    title: "業務端末・アカウントの受領",
    description: "PC・携帯・メールアカウント等の受け取りと初期設定",
  },
];

export type OffboardingTaskSeed = {
  task_type:
    | "resignation_letter"
    | "equipment_return"
    | "final_expense"
    | "paid_leave_settlement"
    | "social_insurance"
    | "employment_certificate"
    | "account_deactivation"
    | "farewell";
  title: string;
  description: string;
};

export const OFFBOARDING_TASK_SEEDS: OffboardingTaskSeed[] = [
  {
    task_type: "resignation_letter",
    title: "退職届・合意書",
    description: "必要書式の提出と捺印",
  },
  {
    task_type: "equipment_return",
    title: "備品返却",
    description: "PC・携帯・鍵・社員証などの返却",
  },
  {
    task_type: "final_expense",
    title: "最終経費精算",
    description: "未精算の経費申請の完了",
  },
  {
    task_type: "paid_leave_settlement",
    title: "有給休暇の精算",
    description: "残日数の確認と消化計画のすり合わせ",
  },
  {
    task_type: "social_insurance",
    title: "社会保険の喪失手続き",
    description: "資格喪失届・離職票など（人事と連携）",
  },
  {
    task_type: "employment_certificate",
    title: "離職証明・推薦状の請求",
    description: "必要な場合は人事へ申請",
  },
  {
    task_type: "account_deactivation",
    title: "アカウント無効化",
    description: "最終出勤日翌日に自動で無効化予定（管理側でスケジュール）",
  },
  {
    task_type: "farewell",
    title: "引き継ぎ・退職挨拶",
    description: "担当業務の引き継ぎ完了と関係者へのご挨拶",
  },
];
