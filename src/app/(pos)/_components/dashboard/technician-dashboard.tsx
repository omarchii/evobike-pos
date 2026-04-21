"use client";

import { Wrench, CheckCircle, AlertTriangle, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AttentionPanel, type AttentionPanelProps } from "./attention-panel";

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

type AssemblyPendingRow = {
    id: string;
    productName: string | null;
    imageUrl: string | null;
    sku: string | null;
    color: string | null;
    folio: string | null;
    saleId: string | null;
    minutesPending: number;
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
    attentionAlerts: AttentionPanelProps;
    deliveredYesterdayCount: number;
    assemblyPendingCount: number;
    assemblyPending: AssemblyPendingRow[];
}

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pendiente", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
    IN_PROGRESS: { label: "En Proceso", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
};

type TrendDir = "up" | "down" | "neutral";

function calcCountTrend(today: number, yesterday: number): { label: string; dir: TrendDir } {
    const delta = today - yesterday;
    if (delta === 0 && today === 0) return { label: "Sin entregas ayer", dir: "neutral" };
    if (delta === 0) return { label: "Igual que ayer", dir: "neutral" };
    return delta > 0
        ? { label: `+${delta} vs ayer`, dir: "up" }
        : { label: `${delta} vs ayer`, dir: "down" };
}

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
    attentionAlerts,
    deliveredYesterdayCount,
    assemblyPendingCount,
    assemblyPending,
}: TechnicianDashboardProps): React.JSX.Element {
    const deliveredTrend = calcCountTrend(deliveredTodayCount, deliveredYesterdayCount);
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[1.5rem] font-bold text-[var(--on-surf)] tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)" }}>
                    Panel de Control
                </h1>
                <p className="text-sm text-[var(--on-surf-var)] mt-0.5">Taller · {branchName}</p>
            </div>

            <AttentionPanel {...attentionAlerts} />

            {/* Panel 1: 4 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Activas — accent */}
                <div className="rounded-[var(--r-lg)] p-5 text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-white/70">
                            ACTIVAS
                        </span>
                        <Wrench className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-white leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>{activeOrdersCount}</p>
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
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
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
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {deliveredTodayCount}
                    </p>
                    <p className={`text-[11px] mt-1 font-medium inline-flex items-center gap-1 ${deliveredTrend.dir === "up" ? "text-[var(--sec)]" : deliveredTrend.dir === "down" ? "text-[var(--ter)]" : "text-[var(--on-surf-var)]"}`}>
                        {deliveredTrend.dir === "up" ? <TrendingUp className="h-3 w-3 shrink-0" /> : deliveredTrend.dir === "down" ? <TrendingDown className="h-3 w-3 shrink-0" /> : <Minus className="h-3 w-3 shrink-0" />}
                        {deliveredTrend.label}
                    </p>
                </div>

                {/* KPI 4: Reensambles */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            REENSAMBLES
                        </span>
                        <Wrench className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {assemblyPendingCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">
                        {assemblyPendingCount === 0 ? "Sin reensambles pendientes" : "Pendientes de completar"}
                    </p>
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
                                    <div key={order.id} className="flex items-center gap-3 py-2 border-b border-[var(--ghost-border)] last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/workshop/${order.id}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                    {order.folio}
                                                </Link>
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
                                <div key={order.id} className="flex items-start gap-3 py-2 border-b border-[var(--ghost-border)] last:border-0">
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/workshop/${order.id}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                            {order.folio}
                                        </Link>
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

            {/* Panel 4: Cola de Reensambles */}
            {assemblyPending.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-[var(--on-surf-var)]" />
                            <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                                Cola de Reensambles
                            </h2>
                        </div>
                        <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--warn-container)] text-[var(--warn)]">
                            {assemblyPendingCount} pendientes
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {assemblyPending.map((a) => {
                            const isLate = a.minutesPending > 4320;
                            return (
                                <div
                                    key={a.id}
                                    className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col"
                                >
                                    {/* Product image */}
                                    <div className="relative w-full aspect-square bg-[var(--surf-low)]">
                                        {a.imageUrl ? (
                                            <Image
                                                src={a.imageUrl}
                                                alt={a.productName ?? "Producto"}
                                                fill
                                                className="object-contain p-2"
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Package className="h-10 w-10 text-[var(--on-surf-var)] opacity-30" />
                                            </div>
                                        )}
                                        {/* Time badge */}
                                        <span className={cn(
                                            "absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full",
                                            isLate
                                                ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                                                : "bg-[var(--surf-lowest)]/80 text-[var(--on-surf-var)] backdrop-blur-sm"
                                        )}>
                                            {formatTiempo(a.minutesPending)}
                                        </span>
                                    </div>

                                    {/* Card body */}
                                    <div className="p-3 flex-1 flex flex-col gap-1">
                                        <p className="text-sm font-medium text-[var(--on-surf)] leading-tight line-clamp-2">
                                            {a.productName ?? "Producto sin asignar"}
                                        </p>
                                        {a.color && (
                                            <p className="text-[10px] text-[var(--on-surf-var)]">{a.color}</p>
                                        )}
                                        {a.sku && (
                                            <p className="font-mono text-[10px] text-[var(--on-surf-var)] opacity-60">{a.sku}</p>
                                        )}
                                        {a.folio && (
                                            <div className="mt-auto pt-2">
                                                {a.saleId ? (
                                                    <Link href={`/ventas/${a.saleId}`} className="font-mono text-[11px] text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                        {a.folio}
                                                    </Link>
                                                ) : (
                                                    <span className="font-mono text-[11px] text-[var(--on-surf-var)]">{a.folio}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Panel 5: Alertas de Mantenimiento */}
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
                                <tr className="border-b border-[var(--ghost-border)]">
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
