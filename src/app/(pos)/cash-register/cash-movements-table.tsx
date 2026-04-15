"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
    Banknote,
    CreditCard,
    Landmark,
    HandCoins,
    Sparkles,
    PiggyBank,
    Receipt,
    Vault,
    CornerUpLeft,
    ExternalLink,
    Inbox,
} from "lucide-react";
import type { CashTransactionType, PaymentMethod } from "@prisma/client";
import type { SerializedCashTransaction } from "@/lib/cash-register";
import { CollectPendingButton } from "./collect-pending-button";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
}

function formatTime(iso: string): string {
    return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso));
}

function getOperatorParts(fullName: string): { initials: string; first: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { initials: "?", first: "—" };
    const first = parts[0];
    const second = parts[1];
    const initials = second
        ? `${first[0]}${second[0]}`.toUpperCase()
        : first.slice(0, 2).toUpperCase();
    return { initials, first };
}

// ── Filter taxonomy (URL param `?tipo=`) ──────────────────────────────────────

type TipoKey = "todos" | "cobros" | "gastos" | "retiros" | "entradas" | "reembolsos";

const TIPO_FILTERS: ReadonlyArray<{
    key: TipoKey;
    label: string;
    types: ReadonlyArray<CashTransactionType> | null;
}> = [
    { key: "todos", label: "Todos", types: null },
    { key: "cobros", label: "Cobros", types: ["PAYMENT_IN"] },
    { key: "gastos", label: "Gastos", types: ["EXPENSE_OUT"] },
    { key: "retiros", label: "Retiros", types: ["WITHDRAWAL"] },
    { key: "entradas", label: "Entradas", types: ["CASH_DEPOSIT"] },
    { key: "reembolsos", label: "Reembolsos", types: ["REFUND_OUT"] },
] as const;

function parseTipo(raw: string | null): TipoKey {
    const match = TIPO_FILTERS.find((f) => f.key === raw);
    return match ? match.key : "todos";
}

// ── Type + method metadata ────────────────────────────────────────────────────

type Category = "in" | "out";

function getTypeMeta(type: CashTransactionType): {
    label: string;
    category: Category;
    icon: React.ReactNode;
} {
    switch (type) {
        case "PAYMENT_IN":
            return { label: "Cobro", category: "in", icon: <Banknote className="h-3.5 w-3.5" /> };
        case "CASH_DEPOSIT":
            return { label: "Entrada", category: "in", icon: <PiggyBank className="h-3.5 w-3.5" /> };
        case "EXPENSE_OUT":
            return { label: "Gasto", category: "out", icon: <Receipt className="h-3.5 w-3.5" /> };
        case "WITHDRAWAL":
            return { label: "Retiro", category: "out", icon: <Vault className="h-3.5 w-3.5" /> };
        case "REFUND_OUT":
            return { label: "Reembolso", category: "out", icon: <CornerUpLeft className="h-3.5 w-3.5" /> };
    }
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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    transactions: SerializedCashTransaction[];
}

export function CashMovementsTable({ transactions }: Props): React.ReactElement {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    const activeTipo = parseTipo(searchParams.get("tipo"));

    const counts = new Map<TipoKey, number>();
    counts.set("todos", transactions.length);
    for (const filter of TIPO_FILTERS) {
        const types = filter.types;
        if (types === null) continue;
        counts.set(
            filter.key,
            transactions.filter((t) => types.includes(t.type)).length,
        );
    }

    const visible = (() => {
        if (activeTipo === "todos") return transactions;
        const filter = TIPO_FILTERS.find((x) => x.key === activeTipo);
        const types = filter?.types;
        if (!types) return transactions;
        return transactions.filter((t) => types.includes(t.type));
    })();

    function setTipo(key: TipoKey): void {
        const params = new URLSearchParams(searchParams.toString());
        if (key === "todos") params.delete("tipo");
        else params.set("tipo", key);
        const qs = params.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
    }

    return (
        <div
            className="rounded-[var(--r-xl)] p-6"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2
                    className="text-[1rem] font-semibold"
                    style={{ color: "var(--on-surf)" }}
                >
                    Movimientos del turno
                </h2>
                <span
                    className="text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    {transactions.length} registros
                </span>
            </div>

            {/* ── Filtros por tipo ── */}
            <div className="flex flex-wrap gap-1.5 mb-5">
                {TIPO_FILTERS.map((f) => {
                    const active = activeTipo === f.key;
                    const count = counts.get(f.key) ?? 0;
                    return (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setTipo(f.key)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-full)] text-[0.75rem] font-medium transition-colors"
                            style={{
                                background: active ? "var(--p-container)" : "var(--surf-high)",
                                color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            {f.label}
                            <span
                                className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.25rem] px-1.5 text-[0.625rem] font-semibold rounded-[var(--r-full)]"
                                style={{
                                    background: active
                                        ? "color-mix(in srgb, var(--on-p-container) 12%, transparent)"
                                        : "var(--surf-lowest)",
                                    color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                                }}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Tabla ── */}
            {visible.length === 0 ? (
                <EmptyState tipo={activeTipo} />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full" style={{ borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <Th>Hora</Th>
                                <Th>Operador</Th>
                                <Th>Tipo</Th>
                                <Th>Método</Th>
                                <Th>Detalle</Th>
                                <Th align="right">Monto</Th>
                                <Th align="right">Acción</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((tx) => (
                                <Row key={tx.id} tx={tx} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}): React.ReactElement {
    return (
        <th
            className="text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
            style={{
                color: "var(--on-surf-var)",
                textAlign: align,
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid var(--ghost-border)",
                fontFamily: "var(--font-body)",
            }}
        >
            {children}
        </th>
    );
}

function Row({ tx }: { tx: SerializedCashTransaction }): React.ReactElement {
    const typeMeta = getTypeMeta(tx.type);
    const methodMeta = getMethodMeta(tx.method);
    const isPending = tx.collectionStatus === "PENDING";
    const isOut = typeMeta.category === "out";
    // Sign sigue typeMeta.category: PAYMENT_IN + CASH_DEPOSIT son inbound (+);
    // EXPENSE_OUT, WITHDRAWAL y REFUND_OUT son outbound (−).
    const signColor = isOut ? "var(--ter)" : "var(--sec)";
    const sign = isOut ? "−" : "+";

    const chipBg = isOut ? "var(--ter-container)" : "var(--sec-container)";
    const chipFg = isOut ? "var(--on-ter-container)" : "var(--on-sec-container)";

    const detail = tx.beneficiary ?? tx.reference ?? tx.notes ?? null;
    const hasSaleLink = tx.saleId !== null && tx.saleFolio !== null;

    return (
        <tr
            className="transition-colors hover:bg-[var(--surf-high)]"
            style={{ color: "var(--on-surf)" }}
        >
            <Td>
                <span
                    className="text-[0.75rem]"
                    style={{ color: "var(--on-surf-var)", fontVariantNumeric: "tabular-nums" }}
                >
                    {formatTime(tx.createdAt)}
                </span>
            </Td>
            <Td>
                <OperatorCell name={tx.userName} />
            </Td>
            <Td>
                <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-full)] text-[0.6875rem] font-medium"
                    style={{ background: chipBg, color: chipFg }}
                >
                    {typeMeta.icon}
                    {typeMeta.label}
                </span>
            </Td>
            <Td>
                <span
                    className="inline-flex items-center gap-1.5 text-[0.75rem]"
                    style={{ color: "var(--on-surf)" }}
                >
                    <span style={{ color: "var(--on-surf-var)" }}>{methodMeta.icon}</span>
                    {methodMeta.label}
                </span>
            </Td>
            <Td>
                <div className="flex items-center gap-2 flex-wrap">
                    {hasSaleLink && (
                        <Link
                            href={`/ventas/${tx.saleId}`}
                            className="inline-flex items-center gap-1 text-[0.75rem] font-medium px-2 py-0.5 rounded-[var(--r-full)] hover:underline"
                            style={{
                                background: "var(--surf-high)",
                                color: "var(--on-surf)",
                            }}
                        >
                            {tx.saleFolio}
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    )}
                    {detail && (
                        <span
                            className="text-[0.75rem] truncate max-w-[22ch]"
                            style={{ color: "var(--on-surf-var)" }}
                            title={detail}
                        >
                            {detail}
                        </span>
                    )}
                </div>
            </Td>
            <Td align="right">
                <span
                    className="text-[0.8125rem] font-semibold"
                    style={{ color: signColor, fontVariantNumeric: "tabular-nums" }}
                >
                    {sign} {formatCurrency(tx.amount)}
                </span>
            </Td>
            <Td align="right">
                {isPending && tx.type === "PAYMENT_IN" ? (
                    <CollectPendingButton
                        transactionId={tx.id}
                        methodLabel={methodMeta.label}
                        amountLabel={formatCurrency(tx.amount)}
                    />
                ) : (
                    <span style={{ color: "var(--on-surf-var)" }}>—</span>
                )}
            </Td>
        </tr>
    );
}

function OperatorCell({ name }: { name: string | null }): React.ReactElement {
    if (!name) {
        return (
            <span style={{ color: "var(--on-surf-var)" }}>—</span>
        );
    }
    const { initials, first } = getOperatorParts(name);
    return (
        <span
            className="inline-flex items-center gap-2 text-[0.75rem]"
            style={{ color: "var(--on-surf)" }}
            title={name}
        >
            <span
                className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[0.625rem] font-semibold"
                style={{
                    background: "var(--surf-high)",
                    color: "var(--on-surf-var)",
                }}
            >
                {initials}
            </span>
            <span className="truncate max-w-[10ch]">{first}</span>
        </span>
    );
}

function Td({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}): React.ReactElement {
    return (
        <td
            style={{
                padding: "0.5625rem 0.75rem",
                textAlign: align,
                verticalAlign: "middle",
            }}
        >
            {children}
        </td>
    );
}

function EmptyState({ tipo }: { tipo: TipoKey }): React.ReactElement {
    const label =
        tipo === "todos"
            ? "Aún no hay movimientos en este turno."
            : `Sin movimientos de tipo "${TIPO_FILTERS.find((f) => f.key === tipo)?.label ?? tipo}" en este turno.`;
    return (
        <div
            className="rounded-[var(--r-lg)] py-12 text-center flex flex-col items-center gap-2"
            style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
        >
            <Inbox className="h-6 w-6" />
            <span className="text-[0.8125rem]">{label}</span>
        </div>
    );
}
