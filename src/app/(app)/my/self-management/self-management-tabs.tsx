"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckSheetClient } from "@/app/(app)/my/check-sheet/check-sheet-client";
import { GoalsClient } from "@/app/(app)/my/goals/goals-client";
import { GrowthClient } from "@/app/(app)/my/growth/growth-client";

export type SelfManagementTabSlug = "goals" | "check" | "growth";

const TAB_LABELS = ["月間目標", "チェックシート", "成長履歴"] as const;
type TabLabel = (typeof TAB_LABELS)[number];

const SLUG_TO_LABEL: Record<SelfManagementTabSlug, TabLabel> = {
  goals: "月間目標",
  check: "チェックシート",
  growth: "成長履歴",
};

const LABEL_TO_SLUG: Record<TabLabel, SelfManagementTabSlug> = {
  月間目標: "goals",
  チェックシート: "check",
  成長履歴: "growth",
};

type GoalsBundle = Parameters<typeof GoalsClient>[0];
type CheckSheetBundle = Parameters<typeof CheckSheetClient>[0];
type GrowthBundle = Parameters<typeof GrowthClient>[0];

export function SelfManagementTabs({
  initialSlug,
  goals,
  checkSheet,
  growth,
}: {
  initialSlug: SelfManagementTabSlug;
  goals: GoalsBundle;
  checkSheet: CheckSheetBundle;
  growth: GrowthBundle;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabLabel>(SLUG_TO_LABEL[initialSlug]);

  useEffect(() => {
    setActiveTab(SLUG_TO_LABEL[initialSlug]);
  }, [initialSlug]);

  function selectTab(label: TabLabel) {
    setActiveTab(label);
    router.replace(`/my/self-management?tab=${LABEL_TO_SLUG[label]}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">自己管理</h1>

      <div className="mb-6 flex gap-2 border-b border-zinc-700">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => selectTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={activeTab === "月間目標" ? "block" : "hidden"}>
        <h2 className="mb-4 text-lg font-bold">月間目標・KPI</h2>
        <GoalsClient {...goals} />
      </div>

      <div className={activeTab === "チェックシート" ? "block" : "hidden"}>
        <h2 className="mb-4 text-lg font-bold">黄金ルール評価表</h2>
        <CheckSheetClient {...checkSheet} />
      </div>

      <div className={activeTab === "成長履歴" ? "block" : "hidden"}>
        <h2 className="mb-4 text-lg font-bold">成長履歴</h2>
        <GrowthClient {...growth} />
      </div>
    </div>
  );
}
