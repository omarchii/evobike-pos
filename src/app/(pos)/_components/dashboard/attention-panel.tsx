"use client";

import { AlertTriangle, Clock, Package, Wrench, FileText, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type PolizaDetenidaAlert = {
    id: string;
    folio: string;
    customerName: string | null;
};

export type BackorderVencidoAlert = {
    id: string;
    folio: string;
    diasPendiente: number;
    customerName: string | null;
};

export type CotizacionPorVencerAlert = {
    id: string;
    folio: string;
    horasRestantes: number;
    customerName: string | null;
};

export type StockCriticoAlert = {
    productVariantId: string;
    productName: string;
    sku: string;
    quantity: number;
};

export type ReensamblePendienteAlert = {
    id: string;
    productName: string | null;
    folio: string | null;
};

export interface AttentionPanelProps {
    polizasDetenidas: PolizaDetenidaAlert[];
    backordersVencidos: BackorderVencidoAlert[];
    cotizacionesPorVencer: CotizacionPorVencerAlert[];
    stockCritico: StockCriticoAlert[];
    reensamblesPendientes: ReensamblePendienteAlert[];
    stockCriticoCount?: number;
    reensamblesPendientesCount?: number;
}

function UrgencyDot({ level }: { level: "critical" | "warning" }): React.JSX.Element {
    return (
        <span
            className={cn(
                "shrink-0 w-1.5 h-1.5 rounded-full",
                level === "critical" ? "bg-[var(--ter)]" : "bg-[var(--warn)]"
            )}
        />
    );
}

function AlertRow({
    urgency,
    icon,
    label,
    meta,
    href,
}: {
    urgency: "critical" | "warning";
    icon: React.ReactNode;
    label: React.ReactNode;
    meta: string;
    href?: string;
}): React.JSX.Element {
    const inner = (
        <div
            className={cn(
                "flex items-center gap-3 py-2.5 px-5 transition-colors",
                href && "hover:bg-[var(--surf-high)]"
            )}
        >
            <UrgencyDot level={urgency} />
            <span
                className={cn(
                    "shrink-0",
                    urgency === "critical" ? "text-[var(--ter)]" : "text-[var(--warn)]"
                )}
            >
                {icon}
            </span>
            <div className="flex-1 min-w-0 text-xs text-[var(--on-surf)]">{label}</div>
            <span
                className={cn(
                    "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full",
                    urgency === "critical"
                        ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                        : "bg-[var(--warn-container)] text-[var(--warn)]"
                )}
            >
                {meta}
            </span>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block">
                {inner}
            </Link>
        );
    }
    return inner;
}

export function AttentionPanel({
    polizasDetenidas,
    backordersVencidos,
    cotizacionesPorVencer,
    stockCritico,
    reensamblesPendientes,
    stockCriticoCount = stockCritico.length,
    reensamblesPendientesCount = reensamblesPendientes.length,
}: AttentionPanelProps): React.JSX.Element | null {
    const [collapsed, setCollapsed] = useState(true);

    const totalCount =
        polizasDetenidas.length +
        backordersVencidos.length +
        cotizacionesPorVencer.length +
        stockCriticoCount +
        reensamblesPendientesCount;

    if (totalCount === 0) return null;

    const hasCriticalStock = stockCritico.some((s) => s.quantity === 0);
    const criticalCount =
        polizasDetenidas.length +
        reensamblesPendientesCount +
        (hasCriticalStock ? 1 : 0);

    return (
        <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)] overflow-hidden">
            {/* Header — clickable toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-[var(--surf-low)] hover:bg-[var(--surf-high)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle
                        className={cn(
                            "h-4 w-4",
                            criticalCount > 0 ? "text-[var(--ter)]" : "text-[var(--warn)]"
                        )}
                    />
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                        Necesita atención
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "text-[10px] font-medium px-2.5 py-0.5 rounded-full",
                            criticalCount > 0
                                ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                                : "bg-[var(--warn-container)] text-[var(--warn)]"
                        )}
                    >
                        {totalCount} {totalCount === 1 ? "alerta" : "alertas"}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-[var(--on-surf-var)] transition-transform duration-200",
                            !collapsed && "rotate-180"
                        )}
                    />
                </div>
            </button>

            {/* Alert rows — conditionally shown */}
            {!collapsed && (
                <div className="divide-y-0 py-1">
                    {/* Pólizas detenidas — individual (accionable por folio) */}
                    {polizasDetenidas.map((p) => (
                        <AlertRow
                            key={p.id}
                            urgency="critical"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    <span className="font-mono text-[var(--on-surf-var)]">{p.folio}</span>
                                    {p.customerName && (
                                        <span className="ml-1.5">— {p.customerName}</span>
                                    )}
                                </>
                            }
                            meta="Póliza detenida"
                            href={`/ventas/${p.id}`}
                        />
                    ))}

                    {/* Reensambles — fila resumen */}
                    {reensamblesPendientesCount > 0 && (
                        <AlertRow
                            urgency="critical"
                            icon={<Wrench className="h-3.5 w-3.5" />}
                            label={
                                <span>
                                    {reensamblesPendientesCount}{" "}
                                    {reensamblesPendientesCount === 1
                                        ? "reensamble pendiente"
                                        : "reensambles pendientes"}
                                </span>
                            }
                            meta="Ver montaje"
                            href="/assembly"
                        />
                    )}

                    {/* Stock crítico — fila resumen */}
                    {stockCriticoCount > 0 && (
                        <AlertRow
                            urgency={hasCriticalStock ? "critical" : "warning"}
                            icon={<Package className="h-3.5 w-3.5" />}
                            label={
                                <span>
                                    {stockCriticoCount}{" "}
                                    {stockCriticoCount === 1
                                        ? "producto en stock crítico"
                                        : "productos en stock crítico"}
                                </span>
                            }
                            meta="Ver inventario"
                            href="/reportes/inventario/stock-minimo"
                        />
                    )}

                    {/* Backorders vencidos — individual (accionable por folio) */}
                    {backordersVencidos.map((b) => (
                        <AlertRow
                            key={b.id}
                            urgency="warning"
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    <span className="font-mono text-[var(--on-surf-var)]">{b.folio}</span>
                                    {b.customerName && (
                                        <span className="ml-1.5">— {b.customerName}</span>
                                    )}
                                </>
                            }
                            meta={`${b.diasPendiente}d sin resolver`}
                            href={`/pedidos/${b.id}`}
                        />
                    ))}

                    {/* Cotizaciones por vencer — individual (accionable por folio) */}
                    {cotizacionesPorVencer.map((c) => (
                        <AlertRow
                            key={c.id}
                            urgency={c.horasRestantes <= 12 ? "critical" : "warning"}
                            icon={<FileText className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    <span className="font-mono text-[var(--on-surf-var)]">{c.folio}</span>
                                    {c.customerName && (
                                        <span className="ml-1.5">— {c.customerName}</span>
                                    )}
                                </>
                            }
                            meta={c.horasRestantes <= 1 ? "< 1h" : `vence en ${c.horasRestantes}h`}
                            href={`/cotizaciones/${c.id}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
