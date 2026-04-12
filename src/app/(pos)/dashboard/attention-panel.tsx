"use client";

import { AlertTriangle, Clock, Package, Wrench, FileText } from "lucide-react";
import Link from "next/link";
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
}: AttentionPanelProps): React.JSX.Element | null {
    const totalCount =
        polizasDetenidas.length +
        backordersVencidos.length +
        cotizacionesPorVencer.length +
        stockCritico.length +
        reensamblesPendientes.length;

    if (totalCount === 0) return null;

    const criticalCount =
        polizasDetenidas.length +
        reensamblesPendientes.length +
        stockCritico.filter((s) => s.quantity === 0).length;

    return (
        <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] shadow-[var(--shadow)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(178,204,192,0.15)]">
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
            </div>

            {/* Alert rows */}
            <div className="divide-y-0 py-1">
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

                {reensamblesPendientes.map((r) => (
                    <AlertRow
                        key={r.id}
                        urgency="critical"
                        icon={<Wrench className="h-3.5 w-3.5" />}
                        label={
                            <>
                                {r.folio && (
                                    <span className="font-mono text-[var(--on-surf-var)]">{r.folio} — </span>
                                )}
                                <span>{r.productName ?? "Reensamble sin asignar"}</span>
                            </>
                        }
                        meta="Reensamble pendiente"
                        href="/assembly"
                    />
                ))}

                {stockCritico.map((s) => (
                    <AlertRow
                        key={s.productVariantId}
                        urgency={s.quantity === 0 ? "critical" : "warning"}
                        icon={<Package className="h-3.5 w-3.5" />}
                        label={<span>{s.productName}</span>}
                        meta={s.quantity === 0 ? "Sin stock" : `${s.quantity} unid.`}
                    />
                ))}

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
        </div>
    );
}
