"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function EmployeeIncentiveCell({
  employeeId,
  isSales,
  isService,
}: {
  employeeId: string;
  isSales: boolean;
  isService: boolean;
}) {
  const router = useRouter();
  const [sales, setSales] = useState(isSales);
  const [service, setService] = useState(isService);
  const [pending, setPending] = useState(false);

  const patch = useCallback(
    async (field: "is_sales_target" | "is_service_target", value: boolean) => {
      setPending(true);
      try {
        const res = await fetch("/api/settings/employees", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: employeeId, [field]: value }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          alert(j.error ?? "更新に失敗しました");
          return;
        }
        if (field === "is_sales_target") setSales(value);
        else setService(value);
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [employeeId, router],
  );

  return (
    <div className="flex flex-col gap-1 text-xs">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={sales}
          disabled={pending}
          onChange={(e) => void patch("is_sales_target", e.target.checked)}
        />
        営業
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={service}
          disabled={pending}
          onChange={(e) => void patch("is_service_target", e.target.checked)}
        />
        ｻｰﾋﾞｽ
      </label>
    </div>
  );
}
