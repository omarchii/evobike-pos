"use client";

import { TrendingUp, Banknote, Vault, ArchiveRestore, CheckCircle } from "lucide-react";

type BranchComparisonRow = {
    branchId: string;
    branchCode: string;
    branchName: string;
    revenue: number;
    transactions: number;
};

type RecentSaleRow = {
    id: string;
    folio: string;
    total: number;
    createdAt: Date;
    mainProduct: string | null;
    mainProductVoltaje: string | null;
    vendedor: string;
    paymentMethod: string | null;
};

type ActiveOrderRow = {
    id: string;
    folio: string;
    status: string;
    createdAt: Date;
    customerName: string;
    bikeInfo: string | null;
    bikeVoltaje: string | null;
    minutosTranscurridos: number;
};

type AtratoRow = {
    id: string;
    amount: number;
    createdAt: Date;
    saleForlio: string | null;
    diasPendiente: number;
};

type CommissionRow = {
    id: string;
    amount: number;
    createdAt: Date;
    userName: string;
    userRole: string;
    saleForlio: string;
    saleTotal: number;
};

interface ManagerDashboardProps {
    role: string;
    branchName: string;
    revenueToday: number;
    transactionsToday: number;
    cashInRegister: number;
    activeLayawaysCount: number;
    pendingLayawayAmount: number;
    branchComparison: BranchComparisonRow[];
    recentSales: RecentSaleRow[];
    activeOrders: ActiveOrderRow[];
    atratiPendientes: AtratoRow[];
    atratoTotal: number;
    pendingCommissions: CommissionRow[];
    commissionsTotal: number;
}

const METHOD_BADGE: Record<string, string> = {
    CASH: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    CARD: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    TRANSFER: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    CREDIT_BALANCE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ATRATO: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

const METHOD_LABEL: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    CREDIT_BALANCE: "Saldo",
    ATRATO: "Atrato",
};

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

function formatMXN(value: number): string {
    return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

export function ManagerDashboard({
    role,
    branchName,
    revenueToday,
    transactionsToday,
    cashInRegister,
    activeLayawaysCount,
    pendingLayawayAmount,
    branchComparison,
    recentSales,
    activeOrders,
    atratiPendientes,
    atratoTotal,
    pendingCommissions,
    commissionsTotal,
}: ManagerDashboardProps) {
    const maxRevenue = Math.max(...branchComparison.map((b) => b.revenue), 1);

    return (
        <div className="space-y-6">
            {/* Row 0: Page header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                    {role === "ADMIN" ? "Vista global · Todas las sucursales" : `Resumen diario · ${branchName}`}
                </p>
            </div>

            {/* Row 1: 4 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Ingresos — accent card */}
                <div className="bg-green-500 rounded-[10px] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                            INGRESOS HOY
                        </span>
                        <TrendingUp className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[22px] font-medium text-white">
                        {formatMXN(revenueToday)}
                    </p>
                    <p className="text-[11px] text-white/60 mt-1">Total facturado hoy</p>
                </div>

                {/* KPI 2: Transacciones */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            TRANSACCIONES
                        </span>
                        <Banknote className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {transactionsToday}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Ventas cobradas hoy</p>
                </div>

                {/* KPI 3: Efectivo en caja */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            EFECTIVO EN CAJA
                        </span>
                        <Vault className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {formatMXN(cashInRegister)}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Sesiones abiertas ahora</p>
                </div>

                {/* KPI 4: Apartados */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            APARTADOS
                        </span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {activeLayawaysCount}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        {formatMXN(pendingLayawayAmount)} por liquidar
                    </p>
                </div>
            </div>

            {/* Row 2: Tendencia (col-span-8) + Comparativo (col-span-4) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Tendencia panel */}
                <div className="col-span-12 lg:col-span-8 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Tendencia de Ingresos
                            </h2>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                Análisis de rendimiento semanal
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                                Semana
                            </button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                                Mes
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-56 flex items-center justify-center rounded-[6px] bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-zinc-400 text-sm font-normal">El gráfico se activará en v2</p>
                    </div>
                </div>

                {/* Comparativo de sucursales */}
                <div className="col-span-12 lg:col-span-4 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                        Comparativo de Sucursales
                    </h2>
                    <div className="space-y-4">
                        {branchComparison.map((branch) => {
                            const barWidth = (branch.revenue / maxRevenue) * 100;
                            return (
                                <div key={branch.branchId}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            {branch.branchCode}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            {formatMXN(branch.revenue)}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                        <div
                                            className="h-2 rounded-full bg-green-500"
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                        {branch.transactions} transacciones
                                    </p>
                                </div>
                            );
                        })}
                        {branchComparison.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-4">Sin datos de sucursales.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Últimas ventas (full width) */}
            <div className="bg-white dark:bg-zinc-900 rounded-[10px] border border-zinc-100 dark:border-zinc-800">
                <div className="px-5 pt-5 pb-3">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Últimas Ventas del Día
                    </h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                        {recentSales.length} {recentSales.length === 1 ? "venta registrada" : "ventas registradas"} hoy
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-t border-zinc-100 dark:border-zinc-800">
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Folio</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Producto</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Vendedor</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Método</th>
                                <th className="px-5 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {recentSales.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-zinc-400">
                                        No hay ventas registradas hoy.
                                    </td>
                                </tr>
                            ) : (
                                recentSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                            {sale.folio}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-zinc-800 dark:text-zinc-200">
                                                {sale.mainProduct ?? "—"}
                                            </span>
                                            {sale.mainProductVoltaje && (
                                                <span className="ml-1 text-[10px] text-zinc-400">
                                                    {sale.mainProductVoltaje}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                                            {sale.vendedor}
                                        </td>
                                        <td className="px-5 py-3">
                                            {sale.paymentMethod ? (
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-[6px] ${METHOD_BADGE[sale.paymentMethod] ?? "bg-zinc-100 text-zinc-600"}`}>
                                                    {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-green-600 dark:text-green-400">
                                            {formatMXN(sale.total)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Row 4: Taller (col-span-6) + Atrato (col-span-3) + Comisiones (col-span-3) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Taller Activo */}
                <div className="col-span-12 lg:col-span-6 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                        Taller Activo
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
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-[6px] ${statusInfo.className}`}>
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
                                        <span className={`text-xs font-medium shrink-0 ${isLate ? "text-amber-500" : "text-zinc-400"}`}>
                                            {formatTiempo(order.minutosTranscurridos)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Atrato Pendiente */}
                <div className="col-span-12 lg:col-span-3 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            Atrato Pendiente
                        </h2>
                    </div>
                    {atratoTotal > 0 && (
                        <p className="text-[11px] text-zinc-500 mb-4">
                            {formatMXN(atratoTotal)} por cobrar
                        </p>
                    )}
                    {atratiPendientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-green-500 gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center">Sin cobros Atrato pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-3">
                            {atratiPendientes.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                            {tx.saleForlio ?? "—"}
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            {tx.diasPendiente === 0 ? "Hoy" : `Hace ${tx.diasPendiente}d`}
                                        </p>
                                    </div>
                                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400 shrink-0">
                                        {formatMXN(tx.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Comisiones Pendientes */}
                <div className="col-span-12 lg:col-span-3 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            Comisiones
                        </h2>
                    </div>
                    {commissionsTotal > 0 && (
                        <p className="text-[11px] text-zinc-500 mb-4">
                            {formatMXN(commissionsTotal)} pendientes este mes
                        </p>
                    )}
                    {pendingCommissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-green-500 gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center">No hay comisiones pendientes este mes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-3">
                            {pendingCommissions.map((c) => (
                                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                            {c.userName}
                                        </p>
                                        <p className="font-mono text-[10px] text-zinc-400">
                                            {c.saleForlio}
                                        </p>
                                    </div>
                                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400 shrink-0">
                                        {formatMXN(c.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
