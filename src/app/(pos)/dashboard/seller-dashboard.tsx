"use client";

import { TrendingUp, Banknote, ArchiveRestore, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashSessionInfo {
    isOpen: boolean;
    openingAmt: number;
}

type SellerSaleRow = {
    id: string;
    folio: string;
    total: number;
    createdAt: Date;
    mainProduct: string | null;
    paymentMethod: string | null;
};

type SellerLayawayRow = {
    id: string;
    folio: string;
    total: number;
    customerName: string | null;
    pendingAmount: number;
};

type SellerAtratoRow = {
    id: string;
    amount: number;
    saleForlio: string | null;
    diasPendiente: number;
};

interface SellerDashboardProps {
    branchName: string;
    salesTodayCount: number;
    revenueToday: number;
    activeLayawaysCount: number;
    cashSession: CashSessionInfo;
    recentSales: SellerSaleRow[];
    layaways: SellerLayawayRow[];
    atratoRows: SellerAtratoRow[];
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

function formatMXN(value: number): string {
    return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

export function SellerDashboard({
    branchName,
    salesTodayCount,
    revenueToday,
    activeLayawaysCount,
    cashSession,
    recentSales,
    layaways,
    atratoRows,
}: SellerDashboardProps): React.JSX.Element {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Resumen personal · {branchName}</p>
            </div>

            {/* Panel 1: 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KPI 1: Mis Ventas Hoy — accent */}
                <div className="bg-green-500 rounded-[10px] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                            MIS VENTAS HOY
                        </span>
                        <TrendingUp className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[22px] font-medium text-white">{salesTodayCount}</p>
                    <p className="text-[11px] text-white/60 mt-1">Transacciones cobradas</p>
                </div>

                {/* KPI 2: Mis Ingresos Hoy */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            MIS INGRESOS HOY
                        </span>
                        <Banknote className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {formatMXN(revenueToday)}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Total facturado personal</p>
                </div>

                {/* KPI 3: Mis Apartados */}
                <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            MIS APARTADOS
                        </span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[22px] font-medium text-zinc-900 dark:text-zinc-50">
                        {activeLayawaysCount}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Pendientes de liquidar</p>
                </div>
            </div>

            {/* Panel 2: Estado de Caja */}
            <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                    Estado de Caja
                </h2>
                <div className="flex items-center gap-3">
                    {cashSession.isOpen ? (
                        <>
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                Caja Abierta
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                Fondo inicial: <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatMXN(cashSession.openingAmt)}</span>
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Caja Cerrada
                        </span>
                    )}
                </div>
            </div>

            {/* Panel 3 + 4: Últimas ventas + Apartados activos */}
            <div className="grid grid-cols-12 gap-4">
                {/* Panel 3: Mis Últimas Ventas */}
                <div className="col-span-12 lg:col-span-7 bg-white dark:bg-zinc-900 rounded-[10px] border border-zinc-100 dark:border-zinc-800">
                    <div className="px-5 pt-5 pb-3">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            Mis Últimas Ventas
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Folio</th>
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Producto</th>
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-400">Método</th>
                                    <th className="px-5 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {recentSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-zinc-400">
                                            No hay ventas registradas hoy.
                                        </td>
                                    </tr>
                                ) : (
                                    recentSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                                {sale.folio}
                                            </td>
                                            <td className="px-5 py-3 text-zinc-800 dark:text-zinc-200">
                                                {sale.mainProduct ?? "—"}
                                            </td>
                                            <td className="px-5 py-3">
                                                {sale.paymentMethod ? (
                                                    <span className={cn(
                                                        "text-[10px] font-medium px-2 py-0.5 rounded-[6px]",
                                                        METHOD_BADGE[sale.paymentMethod] ?? "bg-zinc-100 text-zinc-600"
                                                    )}>
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

                {/* Panel 4: Mis Apartados Activos */}
                <div className="col-span-12 lg:col-span-5 bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                        Mis Apartados Activos
                    </h2>
                    {layaways.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                            <p className="text-sm">Sin apartados activos.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {layaways.map((l) => (
                                <div key={l.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{l.folio}</p>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                            {l.customerName ?? "Sin cliente"}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-[11px] text-zinc-400">Total: {formatMXN(l.total)}</p>
                                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                            Pendiente: {formatMXN(l.pendingAmount)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel 5: Atrato por Cobrar */}
            <div className="bg-white dark:bg-zinc-900 rounded-[10px] p-5 border border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                    Atrato por Cobrar
                </h2>
                {atratoRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-green-500 gap-2">
                        <CheckCircle className="h-8 w-8" />
                        <p className="text-xs text-center text-zinc-400">Sin cobros Atrato pendientes.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {atratoRows.map((row) => (
                            <div key={row.id} className="flex items-center justify-between py-2.5">
                                <div className="min-w-0">
                                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                        {row.saleForlio ?? "—"}
                                    </p>
                                    <p className="text-[10px] text-zinc-400">
                                        {row.diasPendiente === 0 ? "Hoy" : `Hace ${row.diasPendiente}d`}
                                    </p>
                                </div>
                                <span className="text-sm font-medium text-orange-600 dark:text-orange-400 shrink-0">
                                    {formatMXN(row.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
