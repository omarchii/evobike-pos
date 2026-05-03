"use client";

import { useState } from "react";
import { Wrench, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { BatteryLotsPanel, type BatteryLotRow } from "./battery-lots-panel";
import { AssemblyBoard, type AssemblyOrderRow } from "./assembly-board";
import type { BatteryVariantOption } from "./new-battery-lot-dialog";

interface Props {
  lots: BatteryLotRow[];
  variants: BatteryVariantOption[];
  pendingOrders: AssemblyOrderRow[];
  completedOrders: AssemblyOrderRow[];
  completedTotal: number;
  completedPage: number;
  completedPageSize: number;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  canComplete: boolean;
  userRole: string;
  batteryAvailabilityMap: Record<string, { available: number; perUnit: number }>;
}

type Tab = "montaje" | "baterias";

export function AssemblyTabsClient({
  lots,
  variants,
  pendingOrders,
  completedOrders,
  completedTotal,
  completedPage,
  completedPageSize,
  search,
  dateFrom,
  dateTo,
  canComplete,
  userRole,
  batteryAvailabilityMap,
}: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>("montaje");

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "montaje", label: "Montaje", Icon: Wrench },
    { id: "baterias", label: "Baterías", Icon: Package },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 p-1 rounded-2xl w-fit"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === id
                ? "shadow-sm"
                : "text-[var(--on-surf-var)] hover:text-[var(--on-surf)]"
            )}
            style={
              activeTab === id
                ? {
                    background: "var(--surf-high)",
                    color: "var(--p)",
                    fontWeight: 600,
                  }
                : {}
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "montaje" && (
        <AssemblyBoard
          pendingOrders={pendingOrders}
          completedOrders={completedOrders}
          completedTotal={completedTotal}
          completedPage={completedPage}
          completedPageSize={completedPageSize}
          search={search}
          dateFrom={dateFrom}
          dateTo={dateTo}
          canComplete={canComplete}
          userRole={userRole}
          batteryVariants={variants}
          batteryAvailabilityMap={batteryAvailabilityMap}
        />
      )}
      {activeTab === "baterias" && (
        <BatteryLotsPanel initialLots={lots} batteryVariants={variants} />
      )}
    </div>
  );
}
