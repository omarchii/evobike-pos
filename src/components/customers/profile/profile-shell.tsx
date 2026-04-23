"use client";

// Shell del perfil de cliente (BRIEF §7.4 — Sub-fase E).
// Maneja la lógica de tabs vía URL (?tab=...) y compone:
//   1. Botón "Volver" + DetailHeader sticky
//   2. KPI strip (3 tarjetas)
//   3. Tabs: Resumen (E) · Ventas (G) · Taller (G) · Bicis (F) ·
//      Cotizaciones (G) · Finanzas (H, MANAGER+) · Datos (I)
//
// Sub-fase E sólo entrega la implementación completa del tab Resumen.
// Los demás tabs renderizan un placeholder con tokens del DESIGN.md
// y enlazan a la vista existente cuando aplica.

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { Icon, type IconName } from "@/components/primitives/icon";
import { CustomerDetailHeader } from "./customer-detail-header";
import { CustomerKpiStrip } from "./customer-kpi-strip";
import { TabResumen } from "./tab-resumen";
import type { CustomerProfileData } from "@/lib/customers/profile-data";

type TabKey =
  | "resumen"
  | "ventas"
  | "taller"
  | "bicis"
  | "cotizaciones"
  | "finanzas"
  | "datos";

interface TabDef {
  key: TabKey;
  label: string;
  icon: IconName;
  managerOnly?: boolean;
  pendingPhase?: string; // Sub-fase que entrega el contenido real.
}

const TABS: TabDef[] = [
  { key: "resumen", label: "Resumen", icon: "dashboard" },
  { key: "ventas", label: "Ventas", icon: "sales", pendingPhase: "G" },
  { key: "taller", label: "Taller", icon: "wrench", pendingPhase: "G" },
  { key: "bicis", label: "Bicis", icon: "bike", pendingPhase: "F" },
  {
    key: "cotizaciones",
    label: "Cotizaciones",
    icon: "invoice",
    pendingPhase: "G",
  },
  {
    key: "finanzas",
    label: "Finanzas",
    icon: "commission",
    managerOnly: true,
    pendingPhase: "H",
  },
  { key: "datos", label: "Datos", icon: "user", pendingPhase: "I" },
];

interface Props {
  data: CustomerProfileData;
  role: string;
}

export function CustomerProfileShell({
  data,
  role,
}: Props): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const isManagerPlus = role === "ADMIN" || role === "MANAGER";
  const canPin = isManagerPlus;

  const tabParam = searchParams.get("tab") as TabKey | null;
  const visibleTabs = TABS.filter((t) => !t.managerOnly || isManagerPlus);
  const active: TabKey = visibleTabs.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "resumen";

  const setTab = (next: TabKey): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "resumen") params.delete("tab");
    else params.set("tab", next);
    startTransition(() => {
      router.replace(`/customers/${data.base.id}?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        <Icon name="chevronLeft" size={13} />
        Volver al directorio
      </Link>

      <CustomerDetailHeader
        customerId={data.base.id}
        name={data.base.name}
        phone={data.base.phone}
        email={data.base.email}
        rfc={data.base.rfc}
        isBusiness={data.base.isBusiness}
        shippingState={data.base.shippingState}
        segments={data.segments}
        tags={data.base.tags}
        isDeleted={data.base.deletedAt !== null}
      />

      <CustomerKpiStrip kpis={data.kpis} />

      <div
        className="rounded-[var(--r-lg)] p-1.5 flex items-center gap-1 overflow-x-auto"
        style={{ background: "var(--surf-low)" }}
      >
        {visibleTabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                borderRadius: "var(--r-md)",
                background: isActive ? "var(--surf-bright)" : "transparent",
                color: isActive ? "var(--p)" : "var(--on-surf-var)",
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? "0px 4px 12px -2px rgba(19,27,46,0.06)" : "none",
              }}
            >
              <Icon name={t.icon} size={13} />
              {t.label}
              {t.key === "ventas" && data.counts.sales > 0 && (
                <Pill count={data.counts.sales} />
              )}
              {t.key === "taller" && data.counts.serviceOrders > 0 && (
                <Pill count={data.counts.serviceOrders} />
              )}
              {t.key === "bicis" && data.counts.bikes > 0 && (
                <Pill count={data.counts.bikes} />
              )}
              {t.key === "cotizaciones" && data.counts.quotations > 0 && (
                <Pill count={data.counts.quotations} />
              )}
            </button>
          );
        })}
      </div>

      {active === "resumen" && (
        <TabResumen
          customerId={data.base.id}
          customerName={data.base.name}
          alerts={data.alerts}
          sidebar={data.sidebar}
          canPin={canPin}
        />
      )}

      {active !== "resumen" && (
        <PendingTab
          tab={visibleTabs.find((t) => t.key === active)!}
          customerId={data.base.id}
        />
      )}
    </div>
  );
}

function Pill({ count }: { count: number }): React.JSX.Element {
  return (
    <span
      className="text-[0.5625rem] font-semibold tabular-nums px-1.5 py-px"
      style={{
        borderRadius: "var(--r-full)",
        background: "var(--surf-high)",
        color: "var(--on-surf-var)",
      }}
    >
      {count}
    </span>
  );
}

function PendingTab({
  tab,
  customerId,
}: {
  tab: TabDef;
  customerId: string;
}): React.JSX.Element {
  return (
    <section
      className="rounded-[var(--r-lg)] p-10 flex flex-col items-center gap-3 text-center"
      style={{ background: "var(--surf-lowest)" }}
    >
      <span
        className="h-12 w-12 rounded-[var(--r-lg)] flex items-center justify-center"
        style={{
          background: "color-mix(in srgb, var(--p) 12%, transparent)",
          color: "var(--p)",
        }}
      >
        <Icon name={tab.icon} size={20} />
      </span>
      <h3
        className="text-base font-semibold tracking-[-0.01em]"
        style={{
          color: "var(--on-surf)",
          fontFamily: "var(--font-display)",
        }}
      >
        Tab {tab.label}
      </h3>
      <p
        className="text-sm max-w-md"
        style={{ color: "var(--on-surf-var)" }}
      >
        El rediseño de este tab se entrega en la sub-fase {tab.pendingPhase}.
        Los datos están disponibles en el sistema y se incorporarán aquí en la
        próxima sesión.
      </p>
      {tab.key === "finanzas" && (
        <Link
          href={`/reportes/clientes/${customerId}`}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
          style={{
            borderRadius: "var(--r-full)",
            background: "var(--surf-high)",
            color: "var(--on-surf)",
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="report" size={13} /> Ver estado de cuenta actual
        </Link>
      )}
    </section>
  );
}
