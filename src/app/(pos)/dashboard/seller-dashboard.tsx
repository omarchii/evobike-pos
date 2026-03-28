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
    CASH: "bg-[var(--sec-container)] text-[var(--on-sec-container)]",
    CARD: "bg-[var(--surf-high)] text-[var(--on-surf)]",
    TRANSFER: "bg-[var(--surf-high)] text-[var(--on-surf)]",
    CREDIT_BALANCE: "bg-[var(--warn-container)] text-[var(--warn)]",
    ATRATO: "bg-[var(--p-container)] text-[var(--on-p-container)]",
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
                <h1 className="text-[1.5rem] font-bold text-[var(--on-surf)] tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)" }}>
                    Panel de Control
                </h1>
                <p className="text-sm text-[var(--on-surf-var)] mt-0.5">Resumen personal · {branchName}</p>
            </div>

            {/* Panel 1: 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KPI 1: Mis Ventas Hoy — accent */}
                <div className="rounded-[var(--r-lg)] p-5 text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-white/70">
                            MIS VENTAS HOY
                        </span>
                        <TrendingUp className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-white leading-none" style={{ fontFamily: "var(--font-display)" }}>{salesTodayCount}</p>
                    <p className="text-[11px] text-white/60 mt-1">Transacciones cobradas</p>
                </div>

                {/* KPI 2: Mis Ingresos Hoy */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            MIS INGRESOS HOY
                        </span>
                        <Banknote className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                        {formatMXN(revenueToday)}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">Total facturado personal</p>
                </div>

                {/* KPI 3: Mis Apartados */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            MIS APARTADOS
                        </span>
                        <ArchiveRestore className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                        {activeLayawaysCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">Pendientes de liquidar</p>
                </div>
            </div>

            {/* Panel 2: Estado de Caja */}
            <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-3">
                    Estado de Caja
                </h2>
                <div className="flex items-center gap-3">
                    {cashSession.isOpen ? (
                        <>
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--sec-container)] text-[var(--on-sec-container)]">
                                Caja Abierta
                            </span>
                            <span className="text-sm text-[var(--on-surf-var)]">
                                Fondo inicial: <span className="font-medium text-[var(--on-surf)]">{formatMXN(cashSession.openingAmt)}</span>
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--warn-container)] text-[var(--warn)]">
                            Caja Cerrada
                        </span>
                    )}
                </div>
            </div>

            {/* Panel 3 + 4: Últimas ventas + Apartados activos */}
            <div className="grid grid-cols-12 gap-4">
                {/* Panel 3: Mis Últimas Ventas */}
                <div className="col-span-12 lg:col-span-7 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)]">
                    <div className="px-5 pt-5 pb-3">
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Mis Últimas Ventas
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[rgba(178,204,192,0.15)]">
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Folio</th>
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Producto</th>
                                    <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Método</th>
                                    <th className="px-5 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-[var(--on-surf-var)]">
                                            No hay ventas registradas hoy.
                                        </td>
                                    </tr>
                                ) : (
                                    recentSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-[var(--surf-high)] transition-colors">
                                            <td className="px-5 py-3 font-mono text-xs text-[var(--on-surf-var)]">
                                                {sale.folio}
                                            </td>
                                            <td className="px-5 py-3 text-[var(--on-surf)]">
                                                {sale.mainProduct ?? "—"}
                                            </td>
                                            <td className="px-5 py-3">
                                                {sale.paymentMethod ? (
                                                    <span className={cn(
                                                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                        METHOD_BADGE[sale.paymentMethod] ?? "bg-[var(--surf-high)] text-[var(--on-surf)]"
                                                    )}>
                                                        {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--on-surf-var)]">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium text-[var(--sec)]">
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
                <div className="col-span-12 lg:col-span-5 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                        Mis Apartados Activos
                    </h2>
                    {layaways.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--on-surf-var)]">
                            <p className="text-sm">Sin apartados activos.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {layaways.map((l) => (
                                <div key={l.id} className="flex items-center justify-between py-2 border-b border-[rgba(178,204,192,0.15)] last:border-0">
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs text-[var(--on-surf-var)]">{l.folio}</p>
                                        <p className="text-sm font-medium text-[var(--on-surf)] truncate">
                                            {l.customerName ?? "Sin cliente"}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-[11px] text-[var(--on-surf-var)]">Total: {formatMXN(l.total)}</p>
                                        <p className="text-sm font-medium text-[var(--warn)]">
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
            <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                    Atrato por Cobrar
                </h2>
                {atratoRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-[var(--sec)] gap-2">
                        <CheckCircle className="h-8 w-8" />
                        <p className="text-xs text-center text-[var(--on-surf-var)]">Sin cobros Atrato pendientes.</p>
                    </div>
                ) : (
                    <div className="divide-y-0">
                        {atratoRows.map((row) => (
                            <div key={row.id} className="flex items-center justify-between py-2.5 border-b border-[rgba(178,204,192,0.15)] last:border-0">
                                <div className="min-w-0">
                                    <p className="font-mono text-xs text-[var(--on-surf-var)]">
                                        {row.saleForlio ?? "—"}
                                    </p>
                                    <p className="text-[10px] text-[var(--on-surf-var)]">
                                        {row.diasPendiente === 0 ? "Hoy" : `Hace ${row.diasPendiente}d`}
                                    </p>
                                </div>
                                <span className="text-sm font-medium text-[var(--warn)] shrink-0">
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
