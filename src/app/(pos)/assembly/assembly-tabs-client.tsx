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
  orders: AssemblyOrderRow[];
  canComplete: boolean;
  userRole: string;
}

type Tab = "montaje" | "baterias";

export function AssemblyTabsClient({
  lots,
  variants,
  orders,
  canComplete,
  userRole,
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
          initialOrders={orders}
          canComplete={canComplete}
          userRole={userRole}
          batteryVariants={variants}
        />
      )}
      {activeTab === "baterias" && (
        <BatteryLotsPanel initialLots={lots} batteryVariants={variants} />
      )}
    </div>
  );
}
