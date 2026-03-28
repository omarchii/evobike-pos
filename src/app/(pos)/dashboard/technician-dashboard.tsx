"use client";

import { Wrench, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TechOrderRow = {
    id: string;
    folio: string;
    status: string;
    createdAt: Date;
    customerName: string;
    bikeInfo: string | null;
    bikeVoltaje: string | null;
    minutosTranscurridos: number;
};

type ReadyOrderRow = {
    id: string;
    folio: string;
    customerName: string;
    bikeInfo: string | null;
};

type MaintenanceAlertRow = {
    bikeId: string;
    bikeModel: string | null;
    bikeVoltaje: string | null;
    customerName: string;
    lastServiceDate: Date | null;
    diasDesdeServicio: number;
};

interface TechnicianDashboardProps {
    branchName: string;
    activeOrdersCount: number;
    readyOrdersCount: number;
    deliveredTodayCount: number;
    activeOrders: TechOrderRow[];
    readyOrders: ReadyOrderRow[];
    maintenanceAlerts: MaintenanceAlertRow[];
}

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pendiente", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
    IN_PROGRESS: { label: "En Proceso", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
};

function formatTiempo(minutos: number): string {
    if (minutos < 60) return `${minutos}m`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export function TechnicianDashboard({
    branchName,
    activeOrdersCount,
    readyOrdersCount,
    deliveredTodayCount,
    activeOrders,
    readyOrders,
    maintenanceAlerts,
}: TechnicianDashboardProps): React.JSX.Element {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[1.5rem] font-bold text-[var(--on-surf)] tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)" }}>
                    Panel de Control
                </h1>
                <p className="text-sm text-[var(--on-surf-var)] mt-0.5">Taller · {branchName}</p>
            </div>

            {/* Panel 1: 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KPI 1: Activas — accent */}
                <div className="rounded-[var(--r-lg)] p-5 text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-white/70">
                            ACTIVAS
                        </span>
                        <Wrench className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-white leading-none" style={{ fontFamily: "var(--font-display)" }}>{activeOrdersCount}</p>
                    <p className="text-[11px] text-white/60 mt-1">Órdenes en trabajo</p>
                </div>

                {/* KPI 2: Listas */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            LISTAS
                        </span>
                        <CheckCircle className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                        {readyOrdersCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">Esperando entrega</p>
                </div>

                {/* KPI 3: Entregadas Hoy */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            ENTREGADAS HOY
                        </span>
                        <CheckCircle className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                        {deliveredTodayCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">Completadas hoy</p>
                </div>
            </div>

            {/* Panel 2 + 3: Órdenes activas + Listas para entregar */}
            <div className="grid grid-cols-12 gap-4">
                {/* Panel 2: Órdenes Activas */}
                <div className="col-span-12 lg:col-span-7 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                        Órdenes Activas
                    </h2>
                    {activeOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--on-surf-var)]">
                            <p className="text-sm">No hay órdenes activas.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeOrders.map((order) => {
                                const statusInfo = ORDER_STATUS[order.status] ?? { label: order.status, className: "bg-[var(--surf-high)] text-[var(--on-surf)]" };
                                const isLate = order.minutosTranscurridos > 2880;
                                return (
                                    <div key={order.id} className="flex items-center gap-3 py-2 border-b border-[rgba(178,204,192,0.15)] last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-[var(--on-surf-var)]">{order.folio}</span>
                                                <span className={cn(
                                                    "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                    statusInfo.className
                                                )}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-[var(--on-surf)] truncate mt-0.5">
                                                {order.customerName}
                                            </p>
                                            {(order.bikeInfo ?? order.bikeVoltaje) && (
                                                <p className="text-[11px] text-[var(--on-surf-var)] truncate">
                                                    {order.bikeInfo}{order.bikeVoltaje ? ` · ${order.bikeVoltaje}` : ""}
                                                </p>
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium shrink-0",
                                            isLate ? "text-[var(--warn)]" : "text-[var(--on-surf-var)]"
                                        )}>
                                            {formatTiempo(order.minutosTranscurridos)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Panel 3: Listas para Entregar */}
                <div className="col-span-12 lg:col-span-5 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                        Listas para Entregar
                    </h2>
                    {readyOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--sec)] gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center text-[var(--on-surf-var)]">Sin órdenes listas pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {readyOrders.map((order) => (
                                <div key={order.id} className="flex items-start gap-3 py-2 border-b border-[rgba(178,204,192,0.15)] last:border-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs text-[var(--on-surf-var)]">{order.folio}</p>
                                        <p className="text-sm font-medium text-[var(--on-surf)] truncate">
                                            {order.customerName}
                                        </p>
                                        {order.bikeInfo && (
                                            <p className="text-[11px] text-[var(--on-surf-var)] truncate">{order.bikeInfo}</p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--sec-container)] text-[var(--on-sec-container)] shrink-0 mt-0.5">
                                        Lista
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel 4: Alertas de Mantenimiento */}
            <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-[var(--warn)]" />
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                        Alertas de Mantenimiento
                    </h2>
                </div>
                {maintenanceAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-[var(--sec)] gap-2">
                        <CheckCircle className="h-8 w-8" />
                        <p className="text-xs text-center text-[var(--on-surf-var)]">Sin alertas de mantenimiento pendientes.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[rgba(178,204,192,0.15)]">
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Bicicleta</th>
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Cliente</th>
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Último Servicio</th>
                                    <th className="pb-2.5 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Días</th>
                                </tr>
                            </thead>
                            <tbody>
                                {maintenanceAlerts.map((alert) => (
                                    <tr key={alert.bikeId} className="hover:bg-[var(--surf-high)] transition-colors">
                                        <td className="py-2.5 pr-4">
                                            <span className="text-[var(--on-surf)]">
                                                {alert.bikeModel ?? "Sin modelo"}
                                            </span>
                                            {alert.bikeVoltaje && (
                                                <span className="ml-1 text-[10px] text-[var(--on-surf-var)]">{alert.bikeVoltaje}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 pr-4 text-[var(--on-surf-var)]">{alert.customerName}</td>
                                        <td className="py-2.5 pr-4 text-[var(--on-surf-var)]">
                                            {alert.lastServiceDate
                                                ? alert.lastServiceDate.toLocaleDateString("es-MX")
                                                : "Sin servicio previo"}
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <span className={cn(
                                                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                alert.diasDesdeServicio >= 999
                                                    ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                                                    : "bg-[var(--warn-container)] text-[var(--warn)]"
                                            )}>
                                                {alert.diasDesdeServicio >= 999 ? "N/A" : `${alert.diasDesdeServicio}d`}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
