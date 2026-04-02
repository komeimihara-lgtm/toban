import { PayslipPortal } from "@/components/payslip/payslip-portal";

export const dynamic = "force-dynamic";

export default function MyPayslipPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        月を切り替えて給与・控除・みなし残業を確認できます。PDFが必要な場合は「印刷・PDF保存」からブラウザのPDF出力を利用してください。
      </p>
      <PayslipPortal />
    </div>
  );
}
