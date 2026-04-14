"use client";

import { TrendingUp, Banknote, Vault, ArchiveRestore, CheckCircle, ArrowRight, Users, Bike, DollarSign, Award } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AttentionPanel, type AttentionPanelProps } from "./attention-panel";
import { AuthorizationInbox } from "./authorization-inbox";

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
    saleId: string | null;
    saleForlio: string | null;
    diasPendiente: number;
};

type CommissionRow = {
    id: string;
    amount: number;
    createdAt: Date;
    userName: string;
    userRole: string;
    saleId: string;
    saleForlio: string;
    saleTotal: number;
};

type SalesByModelRow = {
    name: string;
    revenue: number;
    count: number;
};

type SalesBySellerRow = {
    name: string;
    revenue: number;
    count: number;
};

type PeriodType = "today" | "week" | "month";

interface ManagerDashboardProps {
    role: string;
    branchName: string;
    period: PeriodType;
    periodLabel: string;
    compLabel: string;
    revenueToday: number;
    transactionsToday: number;
    revenueYesterday: number;
    transactionsYesterday: number;
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
    attentionAlerts: AttentionPanelProps;
    salesByModel: SalesByModelRow[];
    salesBySeller: SalesBySellerRow[];
    cashFlow: { collected: number; pending: number };
    commissionsTeam: { pending: number; approved: number };
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

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pendiente", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
    IN_PROGRESS: { label: "En Proceso", className: "bg-[var(--warn-container)] text-[var(--warn)]" },
    COMPLETED: { label: "Completado", className: "bg-[var(--sec-container)] text-[var(--on-sec-container)]" },
    DELIVERED: { label: "Entregado", className: "bg-[var(--sec-container)] text-[var(--on-sec-container)]" },
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

type TrendDir = "up" | "down" | "neutral";
type TrendResult = { label: string; dir: TrendDir };

function calcPctTrend(today: number, yesterday: number, compLabel: string): TrendResult {
    if (yesterday === 0) {
        return today > 0
            ? { label: "Nuevo", dir: "up" }
            : { label: "Sin datos previos", dir: "neutral" };
    }
    const pct = ((today - yesterday) / yesterday) * 100;
    const abs = Math.round(Math.abs(pct));
    return pct >= 0
        ? { label: `+${abs}% ${compLabel}`, dir: "up" }
        : { label: `-${abs}% ${compLabel}`, dir: "down" };
}

function calcCountTrend(today: number, yesterday: number, compLabel: string): TrendResult {
    const delta = today - yesterday;
    if (delta === 0 && today === 0) return { label: "Sin datos previos", dir: "neutral" };
    if (delta === 0) return { label: "Sin cambio", dir: "neutral" };
    return delta > 0
        ? { label: `+${delta} ${compLabel}`, dir: "up" }
        : { label: `${delta} ${compLabel}`, dir: "down" };
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
];

export function ManagerDashboard({
    role,
    branchName,
    period,
    periodLabel,
    compLabel,
    revenueToday,
    transactionsToday,
    revenueYesterday,
    transactionsYesterday,
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
    attentionAlerts,
    salesByModel,
    salesBySeller,
    cashFlow,
    commissionsTeam,
}: ManagerDashboardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const maxRevenue = Math.max(...branchComparison.map((b) => b.revenue), 1);
    const revenueTrend = calcPctTrend(revenueToday, revenueYesterday, compLabel);
    const txTrend = calcCountTrend(transactionsToday, transactionsYesterday, compLabel);
    const maxModelRevenue = Math.max(...salesByModel.map((m) => m.revenue), 1);
    const maxSellerRevenue = Math.max(...salesBySeller.map((s) => s.revenue), 1);

    function handlePeriodChange(newPeriod: PeriodType): void {
        const params = new URLSearchParams(searchParams.toString());
        if (newPeriod === "today") {
            params.delete("period");
        } else {
            params.set("period", newPeriod);
        }
        router.push(`/dashboard?${params.toString()}`);
    }

    return (
        <div className="space-y-6">
            {/* Row 0: Page header + Period selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[1.5rem] font-bold text-[var(--on-surf)] tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)" }}>
                        Panel de Control
                    </h1>
                    <p className="text-sm text-[var(--on-surf-var)] mt-0.5">
                        {role === "ADMIN" ? "Vista global · Todas las sucursales" : `Resumen de ${periodLabel} · ${branchName}`}
                    </p>
                </div>
                <div className="flex gap-1">
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handlePeriodChange(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                period === opt.value
                                    ? "text-white"
                                    : "text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)]"
                            }`}
                            style={period === opt.value ? { background: "linear-gradient(135deg, #1b4332, #2ecc71)" } : undefined}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <AttentionPanel {...attentionAlerts} />

            <AuthorizationInbox />

            {/* Row 1: 4 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Ingresos — accent card */}
                <div className="rounded-[var(--r-lg)] p-5 text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-white/70">
                            INGRESOS {periodLabel.toUpperCase()}
                        </span>
                        <TrendingUp className="h-4 w-4 text-white/70" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-white leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {formatMXN(revenueToday)}
                    </p>
                    <p className={`text-[11px] mt-1 font-medium ${revenueTrend.dir === "up" ? "text-white/80" : revenueTrend.dir === "down" ? "text-white/60" : "text-white/50"}`}>
                        {revenueTrend.dir === "up" ? "↑" : revenueTrend.dir === "down" ? "↓" : "—"} {revenueTrend.label}
                    </p>
                </div>

                {/* KPI 2: Transacciones */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            TRANSACCIONES
                        </span>
                        <Banknote className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {transactionsToday}
                    </p>
                    <p className={`text-[11px] mt-1 font-medium ${txTrend.dir === "up" ? "text-[var(--sec)]" : txTrend.dir === "down" ? "text-[var(--ter)]" : "text-[var(--on-surf-var)]"}`}>
                        {txTrend.dir === "up" ? "↑" : txTrend.dir === "down" ? "↓" : "—"} {txTrend.label}
                    </p>
                </div>

                {/* KPI 3: Efectivo en caja */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            EFECTIVO EN CAJA
                        </span>
                        <Vault className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {formatMXN(cashInRegister)}
                    </p>
                    <Link
                        href="/cash-register"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors"
                    >
                        Ver arqueo
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {/* KPI 4: Apartados */}
                <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                            APARTADOS
                        </span>
                        <ArchiveRestore className="h-4 w-4 text-[var(--on-surf-var)]" />
                    </div>
                    <p className="text-[2.75rem] font-bold text-[var(--on-surf)] leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                        {activeLayawaysCount}
                    </p>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-1">
                        {formatMXN(pendingLayawayAmount)} por liquidar
                    </p>
                </div>
            </div>

            {/* Row 2: Tendencia (col-span-8) + Comparativo (col-span-4) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Tendencia panel */}
                <div className="col-span-12 lg:col-span-8 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                                Tendencia de Ingresos
                            </h2>
                            <p className="text-[11px] text-[var(--on-surf-var)] mt-0.5">
                                Análisis de rendimiento semanal
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                                Semana
                            </button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors">
                                Mes
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-56 flex items-center justify-center rounded-[var(--r-md)] bg-[var(--surf-low)]">
                        <p className="text-[var(--on-surf-var)] text-sm font-normal">El gráfico se activará en v2</p>
                    </div>
                </div>

                {/* Comparativo de sucursales */}
                <div className="col-span-12 lg:col-span-4 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                        Comparativo de Sucursales
                    </h2>
                    <div className="space-y-4">
                        {branchComparison.map((branch) => {
                            const barWidth = (branch.revenue / maxRevenue) * 100;
                            return (
                                <div key={branch.branchId}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-[var(--on-surf)]">
                                            {branch.branchCode}
                                        </span>
                                        <span className="text-xs text-[var(--on-surf-var)]">
                                            {formatMXN(branch.revenue)}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[var(--surf-high)]">
                                        <div
                                            className="h-2 rounded-full"
                                            style={{ width: `${barWidth}%`, background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--on-surf-var)] mt-0.5">
                                        {branch.transactions} transacciones
                                    </p>
                                </div>
                            );
                        })}
                        {branchComparison.length === 0 && (
                            <p className="text-sm text-[var(--on-surf-var)] text-center py-4">Sin datos de sucursales.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Últimas ventas (full width) */}
            <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)]">
                <div className="px-5 pt-5 pb-3">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                        Últimas Ventas
                    </h2>
                    <p className="text-[11px] text-[var(--on-surf-var)] mt-0.5">
                        {recentSales.length} {recentSales.length === 1 ? "venta registrada" : "ventas registradas"} {periodLabel}
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--ghost-border)]">
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Folio</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Producto</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Vendedor</th>
                                <th className="px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Método</th>
                                <th className="px-5 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-surf-var)]">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSales.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--on-surf-var)]">
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
                                        <td className="px-5 py-3">
                                            <span className="text-[var(--on-surf)]">
                                                {sale.mainProduct ?? "—"}
                                            </span>
                                            {sale.mainProductVoltaje && (
                                                <span className="ml-1 text-[10px] text-[var(--on-surf-var)]">
                                                    {sale.mainProductVoltaje}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-[var(--on-surf-var)]">
                                            {sale.vendedor}
                                        </td>
                                        <td className="px-5 py-3">
                                            {sale.paymentMethod ? (
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${METHOD_BADGE[sale.paymentMethod] ?? "bg-[var(--surf-high)] text-[var(--on-surf)]"}`}>
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

            {/* Row 4: Taller (col-span-6) + Atrato (col-span-3) + Comisiones (col-span-3) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Taller Activo */}
                <div className="col-span-12 lg:col-span-6 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em] mb-4">
                        Taller Activo
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
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}>
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
                                        <span className={`text-xs font-medium shrink-0 ${isLate ? "text-[var(--warn)]" : "text-[var(--on-surf-var)]"}`}>
                                            {formatTiempo(order.minutosTranscurridos)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Atrato Pendiente */}
                <div className="col-span-12 lg:col-span-3 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Atrato Pendiente
                        </h2>
                    </div>
                    {atratoTotal > 0 && (
                        <p className="text-[11px] text-[var(--on-surf-var)] mb-4">
                            {formatMXN(atratoTotal)} por cobrar
                        </p>
                    )}
                    {atratiPendientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-[var(--sec)] gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center">Sin cobros Atrato pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-3">
                            {atratiPendientes.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-[var(--ghost-border)] last:border-0">
                                    <div className="min-w-0">
                                        {tx.saleId ? (
                                            <Link href={`/ventas/${tx.saleId}`} className="font-mono text-xs text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                                {tx.saleForlio ?? "—"}
                                            </Link>
                                        ) : (
                                            <p className="font-mono text-xs text-[var(--on-surf-var)]">—</p>
                                        )}
                                        <p className="text-[10px] text-[var(--on-surf-var)]">
                                            {tx.diasPendiente === 0 ? "Hoy" : `Hace ${tx.diasPendiente}d`}
                                        </p>
                                    </div>
                                    <span className="text-sm font-medium text-[var(--warn)] shrink-0">
                                        {formatMXN(tx.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Comisiones Pendientes */}
                <div className="col-span-12 lg:col-span-3 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Comisiones
                        </h2>
                    </div>
                    {commissionsTotal > 0 && (
                        <p className="text-[11px] text-[var(--on-surf-var)] mb-4">
                            {formatMXN(commissionsTotal)} pendientes este mes
                        </p>
                    )}
                    {pendingCommissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-[var(--sec)] gap-2">
                            <CheckCircle className="h-8 w-8" />
                            <p className="text-xs text-center">No hay comisiones pendientes este mes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-3">
                            {pendingCommissions.map((c) => (
                                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[var(--ghost-border)] last:border-0">
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-[var(--on-surf)] truncate">
                                            {c.userName}
                                        </p>
                                        <Link href={`/ventas/${c.saleId}`} className="font-mono text-[10px] text-[var(--p)] hover:underline underline-offset-2 transition-colors">
                                            {c.saleForlio}
                                        </Link>
                                    </div>
                                    <span className="text-sm font-medium text-[var(--warn)] shrink-0">
                                        {formatMXN(c.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Row 5: Ventas por Modelo (col-span-6) + Ventas por Vendedor (col-span-6) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Ventas por Modelo */}
                <div className="col-span-12 lg:col-span-6 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Bike className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Ventas por Modelo
                        </h2>
                    </div>
                    {salesByModel.length === 0 ? (
                        <p className="text-sm text-[var(--on-surf-var)] text-center py-6">Sin ventas en el período.</p>
                    ) : (
                        <div className="space-y-3">
                            {salesByModel.map((model, i) => {
                                const barWidth = (model.revenue / maxModelRevenue) * 100;
                                return (
                                    <div key={model.name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-[var(--on-surf)]">
                                                {i + 1}. {model.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[var(--on-surf-var)]">
                                                    {model.count} {model.count === 1 ? "venta" : "ventas"}
                                                </span>
                                                <span className="text-xs font-medium text-[var(--sec)]">
                                                    {formatMXN(model.revenue)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full bg-[var(--surf-high)]">
                                            <div
                                                className="h-2 rounded-full"
                                                style={{ width: `${barWidth}%`, background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Ventas por Vendedor */}
                <div className="col-span-12 lg:col-span-6 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Ventas por Vendedor
                        </h2>
                    </div>
                    {salesBySeller.length === 0 ? (
                        <p className="text-sm text-[var(--on-surf-var)] text-center py-6">Sin ventas en el período.</p>
                    ) : (
                        <div className="space-y-3">
                            {salesBySeller.map((seller, i) => {
                                const barWidth = (seller.revenue / maxSellerRevenue) * 100;
                                return (
                                    <div key={seller.name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-[var(--on-surf)]">
                                                {i + 1}. {seller.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[var(--on-surf-var)]">
                                                    {seller.count} {seller.count === 1 ? "venta" : "ventas"}
                                                </span>
                                                <span className="text-xs font-medium text-[var(--sec)]">
                                                    {formatMXN(seller.revenue)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full bg-[var(--surf-high)]">
                                            <div
                                                className="h-2 rounded-full bg-[var(--p-bright)]"
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Row 6: Flujo de Caja (col-span-6) + Comisiones del Equipo (col-span-6) */}
            <div className="grid grid-cols-12 gap-4">
                {/* Flujo de Caja */}
                <div className="col-span-12 lg:col-span-6 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Flujo de Caja
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[var(--r-md)] bg-[var(--sec-container)] p-4">
                            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-sec-container)]">
                                COBRADO
                            </span>
                            <p className="text-2xl font-bold text-[var(--on-sec-container)] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                                {formatMXN(cashFlow.collected)}
                            </p>
                        </div>
                        <div className="rounded-[var(--r-md)] bg-[var(--warn-container)] p-4">
                            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--warn)]">
                                PENDIENTE
                            </span>
                            <p className="text-2xl font-bold text-[var(--warn)] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                                {formatMXN(cashFlow.pending)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-[var(--on-surf-var)]">
                            Total del período: {formatMXN(cashFlow.collected + cashFlow.pending)}
                        </span>
                        <Link
                            href="/reportes/caja"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors"
                        >
                            Ver reporte
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* Comisiones del Equipo */}
                <div className="col-span-12 lg:col-span-6 bg-[var(--surf-lowest)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                            Comisiones del Equipo
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[var(--r-md)] bg-[var(--warn-container)] p-4">
                            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--warn)]">
                                POR APROBAR
                            </span>
                            <p className="text-2xl font-bold text-[var(--warn)] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                                {formatMXN(commissionsTeam.pending)}
                            </p>
                        </div>
                        <div className="rounded-[var(--r-md)] bg-[var(--sec-container)] p-4">
                            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--on-sec-container)]">
                                APROBADAS
                            </span>
                            <p className="text-2xl font-bold text-[var(--on-sec-container)] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                                {formatMXN(commissionsTeam.approved)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                        <Link
                            href="/reportes/comisiones"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors"
                        >
                            Gestionar comisiones
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
