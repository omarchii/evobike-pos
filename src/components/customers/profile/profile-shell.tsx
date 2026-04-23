"use client";

// Shell del perfil de cliente (BRIEF §7.4).
// Maneja la lógica de tabs vía URL (?tab=...) y compone header sticky,
// KPI strip y tabs Resumen · Ventas · Taller · Bicis · Cotizaciones ·
// Finanzas (MANAGER+) · Datos.

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { Icon, type IconName } from "@/components/primitives/icon";
import { CustomerDetailHeader } from "./customer-detail-header";
import { CustomerKpiStrip } from "./customer-kpi-strip";
import { TabResumen } from "./tab-resumen";
import { TabBicis } from "./tab-bicis";
import { TabVentas } from "./tab-ventas";
import { TabTaller } from "./tab-taller";
import { TabCotizaciones } from "./tab-cotizaciones";
import { TabFinanzas } from "./tab-finanzas";
import { TabDatos } from "./tab-datos";
import type { CustomerProfileData } from "@/lib/customers/profile-data";
import type {
  BikeCardData,
  QuotationRow,
  SaleRow,
  ServiceOrderRow,
} from "@/lib/customers/profile-tabs-data";
import type {
  DatosData,
  FinanzasData,
} from "@/lib/customers/profile-finanzas-data";

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
}

const TABS: TabDef[] = [
  { key: "resumen", label: "Resumen", icon: "dashboard" },
  { key: "ventas", label: "Ventas", icon: "sales" },
  { key: "taller", label: "Taller", icon: "wrench" },
  { key: "bicis", label: "Bicis", icon: "bike" },
  { key: "cotizaciones", label: "Cotizaciones", icon: "invoice" },
  {
    key: "finanzas",
    label: "Finanzas",
    icon: "commission",
    managerOnly: true,
  },
  { key: "datos", label: "Datos", icon: "user" },
];

interface Props {
  data: CustomerProfileData;
  role: string;
  bikes: BikeCardData[];
  sales: SaleRow[];
  serviceOrders: ServiceOrderRow[];
  quotations: QuotationRow[];
  finanzas: FinanzasData | null;
  datos: DatosData | null;
}

export function CustomerProfileShell({
  data,
  role,
  bikes,
  sales,
  serviceOrders,
  quotations,
  finanzas,
  datos,
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

      {active === "bicis" && (
        <TabBicis
          customerId={data.base.id}
          customerName={data.base.name}
          bikes={bikes}
          role={role}
        />
      )}

      {active === "ventas" && <TabVentas sales={sales} />}

      {active === "taller" && <TabTaller orders={serviceOrders} />}

      {active === "cotizaciones" && <TabCotizaciones quotations={quotations} />}

      {active === "finanzas" && finanzas && (
        <TabFinanzas
          customerId={data.base.id}
          customerName={data.base.name}
          data={finanzas}
        />
      )}

      {active === "datos" && datos && (
        <TabDatos
          customerId={data.base.id}
          base={data.base}
          segments={data.segments}
          data={datos}
          canManage={isManagerPlus}
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

