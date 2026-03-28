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
    PENDING: { label: "Pendiente", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
    IN_PROGRESS: { label: "En Proceso", className: "bg-green-500/10 text-green-600 dark:text-green-400" },
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
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Taller · {branchName}</p>
            </div>

            {/* Panel 1: 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KPI 1: Activas — accent */}
                <div className="bg-green-500 rounded-[10px] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                            ACTIVAS
                        </span>
                        <Wrench className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[22px] font-medium text-white">{activeOrdersCount}</p>
                    <p className="text-[11px] text-white/60 mt-1">Órdenes en trabajo</p>
                </div>

                {/* KPI 2: Listas */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            LISTAS
                        </span>
                        <CheckCircle className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {readyOrdersCount}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Esperando entrega</p>
                </div>

                {/* KPI 3: Entregadas Hoy */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            ENTREGADAS HOY
                        </span>
                        <CheckCircle className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {deliveredTodayCount}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Completadas hoy</p>
                </div>
            </div>

            {/* Panel 2 + 3: Órdenes activas + Listas para entregar */}
            <div className="grid grid-cols-12 gap-4">
                {/* Panel 2: Órdenes Activas */}
                <div className="col-span-12 lg:col-span-7 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                        Órdenes Activas
                    </h2>
                    {activeOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                            <p className="text-sm">No hay órdenes activas.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeOrders.map((order) => {
                                const statusInfo = ORDER_STATUS[order.status] ?? { label: order.status, className: "bg-zinc-100 text-zinc-600" };
                                const isLate = order.minutosTranscurridos > 2880;
                                return (
                                    <div key={order.id} className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-zinc-500">{order.folio}</span>
                                                <span className={cn(
                                                    "text-[10px] font-medium px-2 py-0.5 rounded-[6px]",
                                                    statusInfo.className
                                                )}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                                                {order.customerName}
                                            </p>
                                            {(order.bikeInfo ?? order.bikeVoltaje) && (
                                                <p className="text-[11px] text-zinc-400 truncate">
                                                    {order.bikeInfo}{order.bikeVoltaje ? ` · ${order.bikeVoltaje}` : ""}
                                                </p>
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium shrink-0",
                                            isLate ? "text-amber-500" : "text-zinc-400"
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
                <div className="col-span-12 lg:col-span-5 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                        Listas para Entregar
                    </h2>
                    {readyOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-green-500 gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center text-zinc-400">Sin órdenes listas pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {readyOrders.map((order) => (
                                <div key={order.id} className="flex items-start gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs text-zinc-500">{order.folio}</p>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                            {order.customerName}
                                        </p>
                                        {order.bikeInfo && (
                                            <p className="text-[11px] text-zinc-400 truncate">{order.bikeInfo}</p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-[6px] bg-green-500/10 text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                                        Lista
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel 4: Alertas de Mantenimiento */}
            <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Alertas de Mantenimiento
                    </h2>
                </div>
                {maintenanceAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-green-500 gap-2">
                        <CheckCircle className="h-8 w-8" />
                        <p className="text-xs text-center text-zinc-400">Sin alertas de mantenimiento pendientes.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Bicicleta</th>
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Cliente</th>
                                    <th className="pb-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Último Servicio</th>
                                    <th className="pb-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {maintenanceAlerts.map((alert) => (
                                    <tr key={alert.bikeId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="py-2.5 pr-4">
                                            <span className="text-zinc-800 dark:text-zinc-200">
                                                {alert.bikeModel ?? "Sin modelo"}
                                            </span>
                                            {alert.bikeVoltaje && (
                                                <span className="ml-1 text-[10px] text-zinc-400">{alert.bikeVoltaje}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">{alert.customerName}</td>
                                        <td className="py-2.5 pr-4 text-zinc-500">
                                            {alert.lastServiceDate
                                                ? alert.lastServiceDate.toLocaleDateString("es-MX")
                                                : "Sin servicio previo"}
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <span className={cn(
                                                "text-[10px] font-medium px-2 py-0.5 rounded-[6px]",
                                                alert.diasDesdeServicio >= 999
                                                    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
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
