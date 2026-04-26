"use client";

import { TrendingUp, TrendingDown, Minus, Banknote, ArchiveRestore, CheckCircle, Vault, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AttentionPanel, type AttentionPanelProps } from "./attention-panel";

interface CashSessionInfo {
    isOpen: boolean;
    openingAmt: number;
    cashInDrawer: number;
    totalCobrado: number;
    byMethod: { method: string; amount: number }[];
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
    saleId: string | null;
    saleForlio: string | null;
    diasPendiente: number;
};

type CommissionRow = {
    id: string;
    amount: number;
    status: "PENDING" | "APPROVED" | "PAID";
    createdAt: Date;
    saleId: string;
    saleForlio: string;
};

interface SellerDashboardProps {
    branchName: string;
    salesTodayCount: number;
    revenueToday: number;
    salesYesterdayCount: number;
    revenueYesterday: number;
    activeLayawaysCount: number;
    cashSession: CashSessionInfo;
    recentSales: SellerSaleRow[];
    layaways: SellerLayawayRow[];
    atratoRows: SellerAtratoRow[];
    commissions: CommissionRow[];
    commissionsTotal: number;
    commissionsByStatus: { PENDING: number; APPROVED: number; PAID: number };
    attentionAlerts: AttentionPanelProps;
}

const COMMISSION_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pendiente", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
    APPROVED: { label: "Aprobada", className: "bg-[var(--p-container)] text-[var(--on-p-container)]" },
    PAID: { label: "Pagada", className: "bg-[var(--sec-container)] text-[var(--on-sec-container)]" },
};

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

type TrendDir = "up" | "down" | "neutral";
type TrendResult = { label: string; dir: TrendDir };

function calcPctTrend(today: number, yesterday: number): TrendResult {
    if (yesterday === 0) {
        return today > 0
            ? { label: "Nuevo hoy", dir: "up" }
            : { label: "Sin datos ayer", dir: "neutral" };
    }
    const pct = ((today - yesterday) / yesterday) * 100;
    const abs = Math.round(Math.abs(pct));
    return pct >= 0
        ? { label: `+${abs}% vs ayer`, dir: "up" }
        : { label: `-${abs}% vs ayer`, dir: "down" };
}

function calcCountTrend(today: number, yesterday: number): TrendResult {
    const delta = today - yesterday;
    if (delta === 0 && today === 0) return { label: "Sin datos ayer", dir: "neutral" };
    if (delta === 0) return { label: "Igual que ayer", dir: "neutral" };
    return delta > 0
        ? { label: `+${delta} vs ayer`, dir: "up" }
        : { label: `${delta} vs ayer`, dir: "down" };
}

export function SellerDashboard({
    branchName,
    salesTodayCount,
    revenueToday,
    salesYesterdayCount,
    revenueYesterday,
    activeLayawaysCount,
    cashSession,
    recentSales,
    layaways,
    atratoRows,
    commissions,
    commissionsTotal,
    commissionsByStatus,
    attentionAlerts,
}: SellerDashboardProps): React.JSX.Element {
    const salesTrend = calcCountTrend(salesTodayCount, salesYesterdayCount);
    const revenueTrend = calcPctTrend(revenueToday, revenueYesterday);

    return (
        <div className="space-y-6">
            {/* Header */}
            <p className="text-sm text-[var(--on-surf-var)]">Resumen personal · {branchName}</p>

            <AttentionPanel {...attentionAlerts} />

            {/* Panel 1: 3 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* KPI 1: Mis Ventas Hoy — accent */}
                <div className="rounded-[var(--r-lg)] p-5 text-white" style={{ background: "var(--velocity-gradient)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-white/70">
                            MIS VENTAS HOY
                        </span>
                        <TrendingUp className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-white leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>{salesTodayCount}</p>
                    <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            salesTrend.dir === "up" ? "bg-white/20 text-white" : salesTrend.dir === "down" ? "bg-black/20 text-white/70" : "bg-white/10 text-white/50"
                        }`}>
                            {salesTrend.dir === "up" ? <TrendingUp className="h-3 w-3 shrink-0" /> : salesTrend.dir === "down" ? <TrendingDown className="h-3 w-3 shrink-0" /> : <Minus className="h-3 w-3 shrink-0" />}
                            {salesTrend.label}
                        </span>
                    </div>
                </div>

                {/* KPI 2: Mis Ingresos Hoy */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            MIS INGRESOS HOY
                        </span>
                        <Banknote className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {formatMXN(revenueToday)}
                    </p>
                    <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            revenueTrend.dir === "up" ? "bg-[var(--sec-container)] text-[var(--on-sec-container)]" : revenueTrend.dir === "down" ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]" : "bg-[var(--surf-high)] text-[var(--on-surf-var)]"
                        }`}>
                            {revenueTrend.dir === "up" ? <TrendingUp className="h-3 w-3 shrink-0" /> : revenueTrend.dir === "down" ? <TrendingDown className="h-3 w-3 shrink-0" /> : <Minus className="h-3 w-3 shrink-0" />}
                            {revenueTrend.label}
                        </span>
                    </div>
                </div>

                {/* KPI 3: Mis Apartados */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            MIS APARTADOS
                        </span>
                        <ArchiveRestore className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {activeLayawaysCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">Pendientes de liquidar</p>
                </div>
            </div>

            {/* Panel 2: Caja Viva */}
            <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ghost-border)]">
                    <div className="flex items-center gap-2">
                        <Vault className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Caja de la Sucursal
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "text-[10px] font-medium px-2.5 py-0.5 rounded-full",
                            cashSession.isOpen
                                ? "bg-[var(--sec-container)] text-[var(--on-sec-container)]"
                                : "bg-[var(--warn-container)] text-[var(--warn)]"
                        )}>
                            {cashSession.isOpen ? "Caja abierta" : "Caja cerrada"}
                        </span>
                        {cashSession.isOpen && (
                            <Link
                                href="/cash-register"
                                className="flex items-center gap-1 text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors"
                            >
                                Arqueo
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        )}
                    </div>
                </div>

                {cashSession.isOpen ? (
                    <div className="px-5 py-4">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)] mb-1">
                                    Efectivo en cajón
                                </p>
                                <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                                    {formatMXN(cashSession.cashInDrawer)}
                                </p>
                                <p className="text-[11px] text-[var(--on-surf-var)] mt-1">
                                    Fondo inicial: {formatMXN(cashSession.openingAmt)}
                                </p>
                            </div>
                            {cashSession.totalCobrado > 0 && (
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)] mb-1">
                                        Total cobrado
                                    </p>
                                    <p className="text-[1.5rem] font-bold text-[var(--sec)] leading-none tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)" }}>
                                        {formatMXN(cashSession.totalCobrado)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {cashSession.byMethod.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {cashSession.byMethod.map((m) => (
                                    <div
                                        key={m.method}
                                        className={cn(
                                            "rounded-[var(--r-md)] px-3 py-2",
                                            METHOD_BADGE[m.method] ?? "bg-[var(--surf-high)] text-[var(--on-surf)]"
                                        )}
                                    >
                                        <p className="text-[9px] font-medium uppercase tracking-[0.04em] opacity-70">
                                            {METHOD_LABEL[m.method] ?? m.method}
                                        </p>
                                        <p className="text-sm font-medium mt-0.5">
                                            {formatMXN(m.amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="px-5 py-4 text-sm text-[var(--on-surf-var)]">
                        No tienes un turno abierto en este momento.
                    </div>
                )}
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
                                <tr className="border-b border-[var(--ghost-border)]">
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
                                            <td className="px-5 py-3">
                                                <Link href={`/ventas/${sale.id}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                    {sale.folio}
                                                </Link>
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
                                <div key={l.id} className="flex items-center justify-between py-2 border-b border-[var(--ghost-border)] last:border-0">
                                    <div className="min-w-0">
                                        <Link href={`/pedidos/${l.id}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                            {l.folio}
                                        </Link>
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

            {/* Panel 5 + 6: Atrato + Comisiones en dos columnas */}
            <div className="grid grid-cols-12 gap-4">
                {/* Panel 5: Atrato por Cobrar */}
                <div className="col-span-12 lg:col-span-5 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
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
                                <div key={row.id} className="flex items-center justify-between py-2.5 border-b border-[var(--ghost-border)] last:border-0">
                                    <div className="min-w-0">
                                        {row.saleId ? (
                                            <Link href={`/ventas/${row.saleId}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                {row.saleForlio ?? "—"}
                                            </Link>
                                        ) : (
                                            <p className="font-mono text-xs text-[var(--on-surf-var)]">—</p>
                                        )}
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

                {/* Panel 6: Mis Comisiones del Mes */}
                <div className="col-span-12 lg:col-span-7 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ghost-border)]">
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Mis Comisiones del Mes
                        </h2>
                        {commissionsTotal > 0 && (
                            <span className="text-[13px] font-bold text-[var(--sec)]" style={{ fontFamily: "var(--font-display)" }}>
                                {formatMXN(commissionsTotal)}
                            </span>
                        )}
                    </div>

                    {commissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--sec)] gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center text-[var(--on-surf-var)]">Sin comisiones registradas este mes.</p>
                        </div>
                    ) : (
                        <>
                            {/* Status breakdown */}
                            <div className="flex gap-3 px-5 py-3 border-b border-[var(--ghost-border)]">
                                {(["PENDING", "APPROVED", "PAID"] as const).map((s) => (
                                    commissionsByStatus[s] > 0 && (
                                        <div key={s} className="flex items-center gap-1.5">
                                            <span className={cn(
                                                "text-[9px] font-medium px-2 py-0.5 rounded-full",
                                                COMMISSION_STATUS[s].className
                                            )}>
                                                {COMMISSION_STATUS[s].label}
                                            </span>
                                            <span className="text-xs font-medium text-[var(--on-surf)]">
                                                {formatMXN(commissionsByStatus[s])}
                                            </span>
                                        </div>
                                    )
                                ))}
                            </div>

                            {/* Commission rows */}
                            <div className="divide-y-0">
                                {commissions.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--ghost-border)] last:border-0 hover:bg-[var(--surf-high)] transition-colors">
                                        <div className="min-w-0">
                                            <Link href={`/ventas/${c.saleId}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                {c.saleForlio}
                                            </Link>
                                            <p className="text-[10px] text-[var(--on-surf-var)] mt-0.5">
                                                {c.createdAt.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={cn(
                                                "text-[9px] font-medium px-2 py-0.5 rounded-full",
                                                COMMISSION_STATUS[c.status].className
                                            )}>
                                                {COMMISSION_STATUS[c.status].label}
                                            </span>
                                            <span className="text-sm font-semibold text-[var(--sec)]">
                                                {formatMXN(c.amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
