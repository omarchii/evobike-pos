import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
    Banknote,
    CreditCard,
    Landmark,
    Wallet,
    HandCoins,
    Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashActionsBar } from "./cash-actions-bar";
import { CollectPendingButton } from "./collect-pending-button";
import { OrphanedSessionBanner } from "../orphaned-session-banner";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
}

function formatTime(date: Date): string {
    return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatTimeSince(from: Date, now: Date = new Date()): string {
    const diffMs = now.getTime() - from.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "hace un momento";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    if (hours < 24) return remMin > 0 ? `hace ${hours}h ${remMin}min` : `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export default async function CashRegisterPage(): Promise<React.ReactElement> {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    const user = session.user as SessionUser;
    const branchId = user.branchId;
    const canRegisterWithdrawal = user.role === "MANAGER" || user.role === "ADMIN";

    const activeSession = await prisma.cashRegisterSession.findFirst({
        where: { branchId, status: "OPEN" },
        include: {
            user: { select: { name: true } },
            branch: { select: { name: true } },
            transactions: {
                orderBy: { createdAt: "desc" },
                include: { sale: { select: { id: true, folio: true } } },
            },
        },
    });

    // ── Empty state ───────────────────────────────────────────────────────────
    if (!activeSession) {
        return (
            <div className="max-w-5xl mx-auto">
                <OrphanedSessionBanner branchId={branchId} />
                <div
                    className="mt-8 rounded-[var(--r-xl)] p-12 flex flex-col items-center text-center"
                    style={{
                        background: "var(--surf-lowest)",
                        boxShadow: "var(--shadow)",
                    }}
                >
                    <div
                        className="h-16 w-16 rounded-full flex items-center justify-center mb-5"
                        style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                    >
                        <Wallet className="h-7 w-7" />
                    </div>
                    <h1
                        className="text-[1.5rem] font-bold tracking-[-0.01em]"
                        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                    >
                        Caja cerrada
                    </h1>
                    <p
                        className="mt-2 max-w-md text-[0.875rem]"
                        style={{ color: "var(--on-surf-var)" }}
                    >
                        No hay caja abierta en esta sucursal. La ventana de apertura aparecerá
                        automáticamente al navegar a otras pantallas.
                    </p>
                    <div className="mt-6">
                        <CashActionsBar canRegisterWithdrawal={canRegisterWithdrawal} sessionOpen={false} userRole={user.role} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Totales por método (PAYMENT_IN) y por tipo ────────────────────────────
    const byMethodCollected: Record<PaymentMethod, number> = {
        CASH: 0, CARD: 0, TRANSFER: 0, CREDIT_BALANCE: 0, ATRATO: 0,
    };
    const byMethodPending: Record<PaymentMethod, number> = {
        CASH: 0, CARD: 0, TRANSFER: 0, CREDIT_BALANCE: 0, ATRATO: 0,
    };

    let refundsCash = 0;
    let withdrawalsCash = 0;
    let expensesCash = 0;
    let refundsTotal = 0;
    let withdrawalsTotal = 0;
    let expensesTotal = 0;

    for (const tx of activeSession.transactions) {
        const amt = Number(tx.amount);
        const method = tx.method as PaymentMethod;

        if (tx.type === "PAYMENT_IN") {
            if (tx.collectionStatus === "COLLECTED") byMethodCollected[method] += amt;
            else byMethodPending[method] += amt;
        } else if (tx.type === "REFUND_OUT") {
            refundsTotal += amt;
            if (method === "CASH") refundsCash += amt;
        } else if (tx.type === "WITHDRAWAL") {
            withdrawalsTotal += amt;
            if (method === "CASH") withdrawalsCash += amt;
        } else if (tx.type === "EXPENSE_OUT") {
            expensesTotal += amt;
            if (method === "CASH") expensesCash += amt;
        }
    }

    const openingAmt = Number(activeSession.openingAmt);
    const cashCollected = byMethodCollected.CASH;
    const expectedCashInDrawer =
        openingAmt + cashCollected - refundsCash - withdrawalsCash - expensesCash;

    // Atrato se oculta si nunca hubo movimiento (ni cobrado ni pendiente)
    const atratoTotal = byMethodCollected.ATRATO + byMethodPending.ATRATO;
    const showAtrato = atratoTotal > 0;

    const cobros = activeSession.transactions.filter((t) => t.type === "PAYMENT_IN");
    const reembolsos = activeSession.transactions.filter((t) => t.type === "REFUND_OUT");
    const gastos = activeSession.transactions.filter((t) => t.type === "EXPENSE_OUT");
    const retiros = activeSession.transactions.filter((t) => t.type === "WITHDRAWAL");

    const openerName = activeSession.user.name ?? "–";
    const branchName = activeSession.branch.name;
    const timeSinceLabel = formatTimeSince(activeSession.openedAt);

    // Estado de la sesión: fresca (hoy) u huérfana (del día anterior)
    const isOrphan = activeSession.openedAt.toDateString() !== new Date().toDateString();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <OrphanedSessionBanner branchId={branchId} />

            {/* ── Header ────────────────────────────────────────────────────── */}
            <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1
                            className="text-[1.5rem] font-bold tracking-[-0.01em]"
                            style={{
                                fontFamily: "var(--font-display)",
                                color: "var(--on-surf)",
                            }}
                        >
                            Caja
                        </h1>
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--r-full)] text-[0.625rem] font-medium uppercase tracking-[0.04em]"
                            style={{
                                background: isOrphan ? "var(--warn-container)" : "var(--sec-container)",
                                color: isOrphan ? "var(--warn)" : "var(--on-sec-container)",
                            }}
                        >
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: isOrphan ? "var(--warn)" : "var(--sec)" }}
                            />
                            {isOrphan ? "Huérfana" : "Abierta"}
                        </span>
                    </div>
                    <p
                        className="mt-1.5 text-[0.8125rem]"
                        style={{ color: "var(--on-surf-var)" }}
                    >
                        {branchName} · Abierta por{" "}
                        <span style={{ color: "var(--on-surf)" }}>{openerName}</span> · {timeSinceLabel} ·{" "}
                        {formatTime(activeSession.openedAt)}
                    </p>
                </div>
                <div className="shrink-0">
                    <CashActionsBar canRegisterWithdrawal={canRegisterWithdrawal} sessionOpen={true} userRole={user.role} />
                </div>
            </header>

            {/* ── Grid de KPIs (6 cards) ────────────────────────────────────── */}
            <section
                className="grid gap-4"
                style={{
                    gridTemplateColumns: `repeat(${showAtrato ? 6 : 5}, minmax(0, 1fr))`,
                }}
            >
                <KpiCard
                    label="Fondo inicial"
                    value={openingAmt}
                    icon={<Wallet className="h-4 w-4" />}
                />
                <KpiCard
                    label="Efectivo"
                    value={byMethodCollected.CASH}
                    icon={<Banknote className="h-4 w-4" />}
                    accent="sec"
                />
                <KpiCard
                    label="Tarjeta"
                    value={byMethodCollected.CARD}
                    icon={<CreditCard className="h-4 w-4" />}
                />
                <KpiCard
                    label="Transferencia"
                    value={byMethodCollected.TRANSFER}
                    icon={<Landmark className="h-4 w-4" />}
                />
                <KpiCard
                    label="Saldo a favor"
                    value={byMethodCollected.CREDIT_BALANCE}
                    icon={<Sparkles className="h-4 w-4" />}
                />
                {showAtrato && (
                    <KpiCard
                        label="Atrato"
                        value={byMethodCollected.ATRATO}
                        pending={byMethodPending.ATRATO}
                        icon={<HandCoins className="h-4 w-4" />}
                    />
                )}
            </section>

            {/* ── Panel + Tabs ──────────────────────────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <aside className="lg:col-span-1">
                    <div
                        className="rounded-[var(--r-xl)] p-6 lg:sticky lg:top-6"
                        style={{
                            background: "var(--surf-lowest)",
                            boxShadow: "var(--shadow)",
                        }}
                    >
                        <div
                            className="text-[0.625rem] font-medium uppercase tracking-[0.05em] mb-4"
                            style={{ color: "var(--on-surf-var)" }}
                        >
                            Esperado en cajón
                        </div>

                        <dl className="space-y-2 text-[0.8125rem]">
                            <Row label="Fondo inicial" value={formatCurrency(openingAmt)} />
                            <Row label="+ Efectivo cobrado" value={formatCurrency(cashCollected)} tone="pos" />
                            <Row label="− Reembolsos" value={formatCurrency(refundsCash)} tone="neg" />
                            <Row label="− Retiros" value={formatCurrency(withdrawalsCash)} tone="neg" />
                            <Row label="− Gastos" value={formatCurrency(expensesCash)} tone="neg" />
                        </dl>

                        <div
                            className="mt-5 pt-5"
                            style={{ borderTop: "1px solid var(--ghost-border)" }}
                        >
                            <div
                                className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                                style={{ color: "var(--on-surf-var)" }}
                            >
                                Total esperado
                            </div>
                            <div
                                className="mt-1 text-[2rem] font-bold tracking-[-0.02em]"
                                style={{
                                    fontFamily: "var(--font-display)",
                                    color: "var(--on-surf)",
                                }}
                            >
                                {formatCurrency(expectedCashInDrawer)}
                            </div>
                        </div>

                        <div
                            className="mt-5 grid grid-cols-2 gap-2 text-[0.6875rem]"
                            style={{ color: "var(--on-surf-var)" }}
                        >
                            <Counter label="Cobros" count={cobros.length} />
                            <Counter label="Reembolsos" count={reembolsos.length} />
                            <Counter label="Gastos" count={gastos.length} />
                            <Counter label="Retiros" count={retiros.length} />
                        </div>
                    </div>
                </aside>

                <div className="lg:col-span-2">
                    <div
                        className="rounded-[var(--r-xl)] p-6"
                        style={{
                            background: "var(--surf-lowest)",
                            boxShadow: "var(--shadow)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2
                                className="text-[1rem] font-semibold"
                                style={{ color: "var(--on-surf)" }}
                            >
                                Transacciones del turno
                            </h2>
                            <span
                                className="text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
                                style={{ color: "var(--on-surf-var)" }}
                            >
                                {activeSession.transactions.length} registros
                            </span>
                        </div>

                        <Tabs defaultValue="cobros">
                            <TabsList
                                className="h-auto p-1 rounded-[var(--r-full)] w-full justify-start gap-1"
                                style={{ background: "var(--surf-high)" }}
                            >
                                <TabTrigger value="cobros" label="Cobros" count={cobros.length} />
                                <TabTrigger value="reembolsos" label="Reembolsos" count={reembolsos.length} />
                                <TabTrigger value="gastos" label="Gastos" count={gastos.length} />
                                <TabTrigger value="retiros" label="Retiros" count={retiros.length} />
                            </TabsList>

                            <TabsContent value="cobros" className="mt-4">
                                <TxList txs={cobros} emptyLabel="Aún no hay cobros registrados en este turno." />
                            </TabsContent>
                            <TabsContent value="reembolsos" className="mt-4">
                                <TxList txs={reembolsos} emptyLabel="Sin reembolsos en este turno." />
                            </TabsContent>
                            <TabsContent value="gastos" className="mt-4">
                                <TxList txs={gastos} emptyLabel="Sin gastos registrados en este turno." />
                            </TabsContent>
                            <TabsContent value="retiros" className="mt-4">
                                <TxList txs={retiros} emptyLabel="Sin retiros registrados en este turno." />
                            </TabsContent>
                        </Tabs>

                        <div
                            className="mt-4 text-[0.6875rem] text-right"
                            style={{ color: "var(--on-surf-var)" }}
                        >
                            Totales — Reembolsos {formatCurrency(refundsTotal)} · Retiros{" "}
                            {formatCurrency(withdrawalsTotal)} · Gastos {formatCurrency(expensesTotal)}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ── Sub-componentes presentacionales ──────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: number;
    pending?: number;
    icon: React.ReactNode;
    accent?: "default" | "sec";
}

function KpiCard({ label, value, pending, icon, accent = "default" }: KpiCardProps): React.ReactElement {
    const valueColor = accent === "sec" ? "var(--sec)" : "var(--on-surf)";
    return (
        <div
            className="rounded-[var(--r-xl)] p-5"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
            <div className="flex items-center justify-between">
                <div
                    className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    {label}
                </div>
                <div style={{ color: "var(--on-surf-var)" }}>{icon}</div>
            </div>
            <div
                className="mt-3 text-[1.5rem] font-bold tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-display)", color: valueColor }}
            >
                {formatCurrency(value)}
            </div>
            {pending !== undefined && pending > 0 && (
                <div
                    className="mt-1 text-[0.6875rem]"
                    style={{ color: "var(--warn)" }}
                >
                    {formatCurrency(pending)} pendiente
                </div>
            )}
        </div>
    );
}

interface RowProps {
    label: string;
    value: string;
    tone?: "neutral" | "pos" | "neg";
}

function Row({ label, value, tone = "neutral" }: RowProps): React.ReactElement {
    const valueColor =
        tone === "pos" ? "var(--sec)" : tone === "neg" ? "var(--ter)" : "var(--on-surf)";
    return (
        <div className="flex items-center justify-between">
            <dt style={{ color: "var(--on-surf-var)" }}>{label}</dt>
            <dd
                className="font-medium"
                style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </dd>
        </div>
    );
}

function Counter({ label, count }: { label: string; count: number }): React.ReactElement {
    return (
        <div
            className="rounded-[var(--r-md)] px-3 py-2 flex items-center justify-between"
            style={{ background: "var(--surf-high)" }}
        >
            <span>{label}</span>
            <span
                className="font-semibold"
                style={{ color: "var(--on-surf)", fontVariantNumeric: "tabular-nums" }}
            >
                {count}
            </span>
        </div>
    );
}

interface TabTriggerProps {
    value: string;
    label: string;
    count: number;
}

function TabTrigger({ value, label, count }: TabTriggerProps): React.ReactElement {
    return (
        <TabsTrigger
            value={value}
            className="flex-1 rounded-[var(--r-full)] text-[0.8125rem] font-medium data-[state=active]:bg-[var(--surf-lowest)] data-[state=active]:text-[var(--p)] data-[state=active]:shadow-sm"
            style={{ color: "var(--on-surf-var)" }}
        >
            <span className="flex items-center gap-1.5">
                {label}
                <span
                    className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.25rem] px-1.5 text-[0.625rem] font-semibold rounded-[var(--r-full)]"
                    style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                >
                    {count}
                </span>
            </span>
        </TabsTrigger>
    );
}

// ── Lista de transacciones ────────────────────────────────────────────────────

type TxWithSale = {
    id: string;
    type: string;
    method: PaymentMethod;
    amount: unknown;
    reference: string | null;
    collectionStatus: string;
    createdAt: Date;
    saleId: string | null;
    sale: { id: string; folio: string } | null;
};

function TxList({ txs, emptyLabel }: { txs: TxWithSale[]; emptyLabel: string }): React.ReactElement {
    if (txs.length === 0) {
        return (
            <div
                className="rounded-[var(--r-lg)] py-10 text-center text-[0.8125rem]"
                style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
            >
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
            {txs.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
            ))}
        </div>
    );
}

function TxRow({ tx }: { tx: TxWithSale }): React.ReactElement {
    const amount = Number(tx.amount);
    const isOut =
        tx.type === "REFUND_OUT" || tx.type === "WITHDRAWAL" || tx.type === "EXPENSE_OUT";
    const signColor = isOut ? "var(--ter)" : "var(--sec)";
    const sign = isOut ? "−" : "+";

    const methodMeta = getMethodMeta(tx.method);
    const typeMeta = getTypeMeta(tx.type);
    const isPending = tx.collectionStatus === "PENDING";

    return (
        <div
            className="rounded-[var(--r-lg)] px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--surf-high)]"
            style={{ background: "var(--surf-low)" }}
        >
            <div
                className="h-9 w-9 rounded-[var(--r-full)] flex items-center justify-center shrink-0"
                style={{ background: methodMeta.bg, color: methodMeta.fg }}
            >
                {methodMeta.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="text-[0.8125rem] font-medium"
                        style={{ color: "var(--on-surf)" }}
                    >
                        {typeMeta} · {methodMeta.label}
                    </span>
                    {tx.sale && (
                        <Link
                            href={`/ventas/${tx.sale.id}`}
                            className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-[var(--r-full)] hover:underline"
                            style={{
                                background: "var(--surf-high)",
                                color: "var(--on-surf-var)",
                            }}
                        >
                            {tx.sale.folio}
                        </Link>
                    )}
                    {isPending && (
                        <span
                            className="text-[0.625rem] font-medium uppercase tracking-[0.04em] px-2 py-0.5 rounded-[var(--r-full)]"
                            style={{
                                background: "var(--warn-container)",
                                color: "var(--warn)",
                            }}
                        >
                            Pendiente
                        </span>
                    )}
                </div>
                <div
                    className="text-[0.6875rem] mt-0.5 truncate"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    {formatTime(tx.createdAt)}
                    {tx.reference ? ` · ${tx.reference}` : ""}
                </div>
            </div>
            {isPending && tx.type === "PAYMENT_IN" && (
                <CollectPendingButton
                    transactionId={tx.id}
                    methodLabel={methodMeta.label}
                    amountLabel={formatCurrency(amount)}
                />
            )}
            <div
                className="text-[0.875rem] font-semibold shrink-0"
                style={{ color: signColor, fontVariantNumeric: "tabular-nums" }}
            >
                {sign} {formatCurrency(amount)}
            </div>
        </div>
    );
}

function getMethodMeta(method: PaymentMethod): {
    label: string;
    bg: string;
    fg: string;
    icon: React.ReactNode;
} {
    switch (method) {
        case "CASH":
            return {
                label: "Efectivo",
                bg: "var(--sec-container)",
                fg: "var(--on-sec-container)",
                icon: <Banknote className="h-4 w-4" />,
            };
        case "CARD":
            return {
                label: "Tarjeta",
                bg: "var(--surf-high)",
                fg: "var(--on-surf)",
                icon: <CreditCard className="h-4 w-4" />,
            };
        case "TRANSFER":
            return {
                label: "Transferencia",
                bg: "var(--surf-high)",
                fg: "var(--on-surf)",
                icon: <Landmark className="h-4 w-4" />,
            };
        case "CREDIT_BALANCE":
            return {
                label: "Saldo a favor",
                bg: "var(--surf-high)",
                fg: "var(--on-surf)",
                icon: <Sparkles className="h-4 w-4" />,
            };
        case "ATRATO":
            return {
                label: "Atrato",
                bg: "var(--p-container)",
                fg: "var(--on-p-container)",
                icon: <HandCoins className="h-4 w-4" />,
            };
    }
}

function getTypeMeta(type: string): string {
    switch (type) {
        case "PAYMENT_IN":
            return "Cobro";
        case "REFUND_OUT":
            return "Reembolso";
        case "EXPENSE_OUT":
            return "Gasto";
        case "WITHDRAWAL":
            return "Retiro";
        default:
            return type;
    }
}

