import { PayslipPortal } from "@/components/payslip/payslip-portal";

export const dynamic = "force-dynamic";

export default function MyPayslipPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PayslipPortal />
    </div>
  );
}
