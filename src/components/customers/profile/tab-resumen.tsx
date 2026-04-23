"use client";

// Tab Resumen del perfil (BRIEF §7.4 — Sub-fase E).
// Layout 2/3 (alertas + timeline) + 1/3 (sidebar sticky).

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { TimelineFeed } from "./timeline-feed";
import { SidebarSummary } from "./sidebar-summary";
import { AddNoteDialog } from "./add-note-dialog";
import type {
  AlertItem,
  SidebarSummary as SidebarData,
} from "@/lib/customers/profile-data";

interface Props {
  customerId: string;
  customerName: string;
  alerts: AlertItem[];
  sidebar: SidebarData;
  canPin: boolean;
}

const ALERT_TONE: Record<
  AlertItem["kind"],
  { background: string; border: string; iconColor: string; icon: "alert" | "clock" | "cash" }
> = {
  MAINTENANCE_OVERDUE: {
    background: "var(--ter-container)",
    border: "var(--ter)",
    iconColor: "var(--on-ter-container)",
    icon: "alert",
  },
  AR_OVERDUE: {
    background: "var(--warn-container)",
    border: "var(--warn)",
    iconColor: "var(--warn)",
    icon: "cash",
  },
  QUOTATION_EXPIRING: {
    background: "var(--warn-container)",
    border: "var(--warn)",
    iconColor: "var(--warn)",
    icon: "clock",
  },
  BALANCE_TO_USE: {
    background: "var(--p-container)",
    border: "var(--p)",
    iconColor: "var(--on-p-container)",
    icon: "cash",
  },
};

export function TabResumen({
  customerId,
  customerName,
  alerts,
  sidebar,
  canPin,
}: Props): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="grid grid-cols-3 gap-6 max-[1100px]:grid-cols-1">
      <div className="col-span-2 flex flex-col gap-5 min-w-0">
        {alerts.length > 0 && (
          <section className="flex flex-col gap-2">
            <p
              className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
              style={{ color: "var(--on-surf-var)" }}
            >
              Alertas activas ({alerts.length})
            </p>
            <ul className="flex flex-col gap-2">
              {alerts.map((a, i) => {
                const tone = ALERT_TONE[a.kind];
                return (
                  <li
                    key={`${a.kind}-${i}`}
                    className="flex items-center gap-3 rounded-[var(--r-md)] px-4 py-3"
                    style={{
                      background: tone.background,
                      borderLeft: `3px solid ${tone.border}`,
                    }}
                  >
                    <span style={{ color: tone.iconColor }} className="shrink-0">
                      <Icon name={tone.icon} size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--on-surf)" }}
                      >
                        {a.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {a.detail}
                      </p>
                    </div>
                    <Link
                      href={a.href}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold"
                      style={{
                        borderRadius: "var(--r-full)",
                        background: "var(--surf-bright)",
                        color: "var(--on-surf)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {a.cta}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section
          className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
          style={{ background: "var(--surf-lowest)" }}
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              className="text-sm font-semibold tracking-[-0.01em]"
              style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
            >
              Timeline
            </h2>
            <AddNoteDialog
              customerId={customerId}
              canPin={canPin}
              onCreated={() => setRefreshKey((k) => k + 1)}
            />
          </header>
          <TimelineFeed customerId={customerId} refreshKey={refreshKey} />
        </section>
      </div>

      <div className="col-span-1">
        <div className="sticky top-[120px]">
          <SidebarSummary
            customerId={customerId}
            customerName={customerName}
            data={sidebar}
          />
        </div>
      </div>
    </div>
  );
}
