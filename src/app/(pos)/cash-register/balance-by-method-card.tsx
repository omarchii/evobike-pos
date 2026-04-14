"use client";

import {
    Banknote,
    CreditCard,
    Landmark,
    Sparkles,
    HandCoins,
    PieChart,
} from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import type { MethodSummary } from "@/lib/cash-register";

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
}

function getMethodMeta(method: PaymentMethod): { label: string; icon: React.ReactNode } {
    switch (method) {
        case "CASH":
            return { label: "Efectivo", icon: <Banknote className="h-3.5 w-3.5" /> };
        case "CARD":
            return { label: "Tarjeta", icon: <CreditCard className="h-3.5 w-3.5" /> };
        case "TRANSFER":
            return { label: "Transferencia", icon: <Landmark className="h-3.5 w-3.5" /> };
        case "CREDIT_BALANCE":
            return { label: "Saldo a favor", icon: <Sparkles className="h-3.5 w-3.5" /> };
        case "ATRATO":
            return { label: "Atrato", icon: <HandCoins className="h-3.5 w-3.5" /> };
    }
}

interface Props {
    byMethod: MethodSummary[];
    grandTotalCollected: number;
}

export function BalanceByMethodCard({
    byMethod,
    grandTotalCollected,
}: Props): React.ReactElement {
    const hasData = byMethod.length > 0;

    return (
        <div
            className="rounded-[var(--r-xl)] p-6"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
            <div className="flex items-center justify-between mb-1">
                <div
                    className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    Balance por método
                </div>
                <span style={{ color: "var(--on-surf-var)" }}>
                    <PieChart className="h-3.5 w-3.5" />
                </span>
            </div>

            <div
                className="mt-1 text-[1.75rem] font-bold tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
                {formatCurrency(grandTotalCollected)}
            </div>
            <div
                className="text-[0.6875rem] mt-0.5"
                style={{ color: "var(--on-surf-var)" }}
            >
                Total cobrado
            </div>

            {hasData ? (
                <ul className="mt-5 space-y-3.5">
                    {byMethod.map((bucket) => {
                        const meta = getMethodMeta(bucket.method);
                        const pct =
                            grandTotalCollected > 0
                                ? (bucket.collected / grandTotalCollected) * 100
                                : 0;
                        return (
                            <li key={bucket.method}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span style={{ color: "var(--on-surf-var)" }}>
                                            {meta.icon}
                                        </span>
                                        <span
                                            className="text-[0.8125rem] truncate"
                                            style={{ color: "var(--on-surf)" }}
                                        >
                                            {meta.label}
                                        </span>
                                        {bucket.pending > 0 && (
                                            <span
                                                className="text-[0.625rem] font-medium uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-[var(--r-full)]"
                                                style={{
                                                    background: "var(--warn-container)",
                                                    color: "var(--warn)",
                                                }}
                                                title={`${formatCurrency(bucket.pending)} pendiente`}
                                            >
                                                +{formatCurrency(bucket.pending)}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className="text-[0.8125rem] font-semibold shrink-0"
                                        style={{
                                            color: "var(--on-surf)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {formatCurrency(bucket.collected)}
                                    </div>
                                </div>
                                <div
                                    className="mt-1.5 h-1.5 rounded-[var(--r-full)] overflow-hidden"
                                    style={{ background: "var(--surf-high)" }}
                                >
                                    <div
                                        className="h-full rounded-[var(--r-full)] transition-[width] duration-500 ease-out"
                                        style={{
                                            width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                                            background:
                                                "linear-gradient(135deg, var(--p) 0%, var(--p-bright) 100%)",
                                        }}
                                    />
                                </div>
                                <div
                                    className="mt-1 text-[0.6875rem]"
                                    style={{
                                        color: "var(--on-surf-var)",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {pct.toFixed(1)}% · {bucket.count}{" "}
                                    {bucket.count === 1 ? "cobro" : "cobros"}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div
                    className="mt-5 rounded-[var(--r-lg)] py-6 text-center text-[0.75rem]"
                    style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                >
                    Sin cobros registrados todavía.
                </div>
            )}
        </div>
    );
}
