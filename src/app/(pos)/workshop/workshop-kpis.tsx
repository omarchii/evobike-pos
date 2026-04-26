"use client";

import { Wrench, CreditCard, PackageCheck, DollarSign, Timer } from "lucide-react";
import { formatMXN } from "@/lib/quotations";

export interface WorkshopKpiData {
    activeOrders: number;
    prepaidPendingDelivery: number;
    readyPendingCharge: number;
    revenueToday: number;
    avgRepairHours: number | null;
}

const KPI_CARD_BASE = "rounded-[var(--r-lg)] p-5";
const KPI_LABEL = "text-[10px] font-medium uppercase tracking-[0.05em]";
const KPI_VALUE = "text-[2rem] font-bold leading-none tracking-[-0.02em]";

export default function WorkshopKpis({ data }: { data: WorkshopKpiData }) {
    const kpis: {
        label: string;
        value: string;
        icon: React.ElementType;
        accent?: boolean;
        sub?: string;
    }[] = [
        {
            label: "Órdenes activas",
            value: String(data.activeOrders),
            icon: Wrench,
            accent: true,
        },
        {
            label: "Pre-pagadas s/ entregar",
            value: String(data.prepaidPendingDelivery),
            icon: CreditCard,
            sub: "Cobradas, pendientes de entrega",
        },
        {
            label: "Listas — cobro pendiente",
            value: String(data.readyPendingCharge),
            icon: PackageCheck,
            sub: "Completadas sin cobrar",
        },
        {
            label: "Ingreso taller hoy",
            value: formatMXN(data.revenueToday),
            icon: DollarSign,
        },
        {
            label: "Tiempo prom. reparación",
            value: data.avgRepairHours !== null
                ? `${data.avgRepairHours}h`
                : "—",
            icon: Timer,
            sub: data.avgRepairHours !== null ? "últimas 30 entregas" : "Sin datos aún",
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((kpi) =>
                kpi.accent ? (
                    <div
                        key={kpi.label}
                        className={`${KPI_CARD_BASE} text-white`}
                        style={{ background: "var(--velocity-gradient)" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className={`${KPI_LABEL} text-white/70`}>{kpi.label}</span>
                            <kpi.icon className="h-4 w-4 text-white/70" />
                        </div>
                        <p
                            className={`${KPI_VALUE} text-white`}
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            {kpi.value}
                        </p>
                        {kpi.sub && (
                            <p className="text-[11px] mt-1 font-medium text-white/60">{kpi.sub}</p>
                        )}
                    </div>
                ) : (
                    <div
                        key={kpi.label}
                        className={`${KPI_CARD_BASE} bg-[var(--surf-low)]`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className={`${KPI_LABEL} text-[var(--on-surf-var)]`}>{kpi.label}</span>
                            <kpi.icon className="h-4 w-4 text-[var(--on-surf-var)]" />
                        </div>
                        <p
                            className={`${KPI_VALUE} text-[var(--on-surf)]`}
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            {kpi.value}
                        </p>
                        {kpi.sub && (
                            <p className="text-[11px] mt-1 text-[var(--on-surf-var)]">{kpi.sub}</p>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
