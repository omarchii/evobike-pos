"use client";

import React, { useState } from "react";
import { AlertTriangle, Wrench, Package, Clock, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ReensambleAlert = {
    assemblyId: string;
    saleId: string;
    saleFolio: string | null;
    productName: string | null;
    customerName: string | null;
};

export type PrepaidStockAlert = {
    orderId: string;
    folio: string;
    customerName: string;
    missingItems: string[];
};

export type StaleOrderAlert = {
    orderId: string;
    folio: string;
    customerName: string;
    bikeInfo: string | null;
    days: number;
    technicianName: string;
};

export interface WorkshopAttentionData {
    reensambles: ReensambleAlert[];
    prepaidNoStock: PrepaidStockAlert[];
    staleOrders: StaleOrderAlert[];
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

export function WorkshopAttention({ data }: { data: WorkshopAttentionData }): React.JSX.Element | null {
    const [collapsed, setCollapsed] = useState(false);

    const totalCount =
        data.reensambles.length + data.prepaidNoStock.length + data.staleOrders.length;

    if (totalCount === 0) return null;

    const criticalCount = data.reensambles.length + data.prepaidNoStock.length;

    return (
        <div className="bg-[var(--surf-lowest)] rounded-[var(--r-lg)] overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
            {/* Header — clickable to collapse */}
            <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--surf-high)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle
                        className={cn(
                            "h-4 w-4",
                            criticalCount > 0 ? "text-[var(--ter)]" : "text-[var(--warn)]"
                        )}
                    />
                    <h2 className="text-[12px] font-semibold text-[var(--on-surf)] tracking-[-0.01em]">
                        Atención requerida
                    </h2>
                    <span
                        className={cn(
                            "text-[10px] font-medium px-2.5 py-0.5 rounded-full",
                            criticalCount > 0
                                ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                                : "bg-[var(--warn-container)] text-[var(--warn)]"
                        )}
                    >
                        {totalCount}
                    </span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-[var(--on-surf-var)] transition-transform duration-200",
                        collapsed && "-rotate-90"
                    )}
                />
            </button>

            {/* Alert rows */}
            {!collapsed && (
                <div className="py-1">
                    {data.reensambles.map((r) => (
                        <AlertRow
                            key={r.assemblyId}
                            urgency="critical"
                            icon={<Wrench className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    {r.saleFolio && (
                                        <span className="font-mono text-[var(--on-surf-var)]">{r.saleFolio} — </span>
                                    )}
                                    <span>{r.productName ?? "Reensamble pendiente"}</span>
                                    {r.customerName && (
                                        <span className="text-[var(--on-surf-var)]"> · {r.customerName}</span>
                                    )}
                                </>
                            }
                            meta="Póliza detenida"
                            href={`/ventas/${r.saleId}`}
                        />
                    ))}

                    {data.prepaidNoStock.map((p) => (
                        <AlertRow
                            key={p.orderId}
                            urgency="critical"
                            icon={<Package className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    <span className="font-mono text-[var(--on-surf-var)]">{p.folio}</span>
                                    <span className="ml-1.5">— {p.customerName}</span>
                                    {p.missingItems.length > 0 && (
                                        <span className="text-[var(--on-surf-var)]">
                                            {" "}· Falta: {p.missingItems.join(", ")}
                                        </span>
                                    )}
                                </>
                            }
                            meta="Sin stock"
                            href={`/workshop/${p.orderId}`}
                        />
                    ))}

                    {data.staleOrders.map((s) => (
                        <AlertRow
                            key={s.orderId}
                            urgency="warning"
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label={
                                <>
                                    <span className="font-mono text-[var(--on-surf-var)]">{s.folio}</span>
                                    <span className="ml-1.5">— {s.bikeInfo ?? s.customerName}</span>
                                    <span className="text-[var(--on-surf-var)]"> · {s.technicianName}</span>
                                </>
                            }
                            meta={`${s.days}d estancada`}
                            href={`/workshop/${s.orderId}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
