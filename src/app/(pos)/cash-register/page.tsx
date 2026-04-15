import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CircleUser, Clock, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { summarizeSession } from "@/lib/cash-register";
import type { SessionSummary } from "@/lib/cash-register";
import { AuthorizationInbox } from "@/components/pos/authorization/authorization-inbox";
import { CashActionsBar } from "./cash-actions-bar";
import { CashMovementsTable } from "./cash-movements-table";
import { BalanceByMethodCard } from "./balance-by-method-card";
import { CashFab } from "./cash-fab";
import { OrphanedInlineBanner } from "./orphaned-inline-banner";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
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
                include: {
                    sale: { select: { id: true, folio: true } },
                    user: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    const summary: SessionSummary | null = activeSession
        ? summarizeSession(activeSession)
        : null;

    // ── Empty state: sin turno abierto ─────────────────────────────────────────
    if (!summary) {
        return (
            <div className="max-w-5xl mx-auto">
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
                        className="text-[1.75rem] font-bold tracking-[-0.01em]"
                        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                    >
                        No hay turno abierto
                    </h1>
                    <p
                        className="mt-2 max-w-md text-[0.875rem]"
                        style={{ color: "var(--on-surf-var)" }}
                    >
                        Abre una caja para comenzar la jornada. Usa el botón de apertura
                        del topbar.
                    </p>
                    <div className="mt-6">
                        <CashActionsBar
                            canRegisterWithdrawal={canRegisterWithdrawal}
                            sessionOpen={false}
                            userRole={user.role}
                            session={null}
                        />
                    </div>
                </div>
            </div>
        );
    }

    const operatorName = summary.openedByName;
    const sessionShortId = summary.sessionId.slice(-5).toUpperCase();
    const trendPct = summary.cashTrendPct;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-24">
            {summary.isOrphaned && (
                <OrphanedInlineBanner
                    openedAt={summary.openedAt}
                    session={summary}
                    userRole={user.role}
                />
            )}

            {/* ── Header ────────────────────────────────────────────────────── */}
            <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="min-w-0">
                    <h1
                        className="text-[2.5rem] lg:text-[3rem] font-bold tracking-[-0.01em] leading-none"
                        style={{
                            fontFamily: "var(--font-display)",
                            color: "var(--on-surf)",
                        }}
                    >
                        Control de Caja
                    </h1>
                    <div
                        className="mt-3 flex items-center gap-3 flex-wrap"
                        style={{ fontFamily: "var(--font-body)" }}
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <Clock
                                className="h-3 w-3"
                                style={{ color: "var(--on-surf-var)" }}
                            />
                            <span
                                className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                                style={{ color: "var(--on-surf-var)" }}
                            >
                                Sesión:
                            </span>
                            <span
                                className="text-[0.75rem]"
                                style={{ color: "var(--on-surf)" }}
                            >
                                #{sessionShortId}
                            </span>
                        </span>
                        <span aria-hidden style={{ color: "var(--on-surf-var)" }}>
                            ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <CircleUser
                                className="h-3 w-3"
                                style={{ color: "var(--on-surf-var)" }}
                            />
                            <span
                                className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                                style={{ color: "var(--on-surf-var)" }}
                            >
                                Operador:
                            </span>
                            <span
                                className="text-[0.75rem]"
                                style={{ color: "var(--on-surf)" }}
                            >
                                {operatorName}
                            </span>
                        </span>
                    </div>
                </div>
                <div className="shrink-0">
                    <CashActionsBar
                        canRegisterWithdrawal={canRegisterWithdrawal}
                        sessionOpen={true}
                        userRole={user.role}
                        session={summary}
                    />
                </div>
            </header>

            {/* ── KPI Grid asimétrico (2fr 1fr 1fr 1fr) ───────────────────── */}
            <section className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-4">
                <HeroCashCard expectedCash={summary.expectedCash} trendPct={trendPct} />
                <KpiCard
                    label="Ingresos del día"
                    value={summary.paymentsInTotal}
                    footer={
                        summary.paymentsInCount === 1
                            ? "1 transacción"
                            : `${summary.paymentsInCount} transacciones`
                    }
                />
                <KpiCard
                    label="Gastos / Retiros"
                    value={summary.outflowTotal}
                    valueColor="var(--ter)"
                    valuePrefix="− "
                    footer={
                        summary.outflowCount === 1
                            ? "1 movimiento"
                            : `${summary.outflowCount} movimientos`
                    }
                />
                <DifferenceCard />
            </section>

            {/* ── Grid inferior 65/35 ─────────────────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6">
                <div className="min-w-0">
                    <CashMovementsTable transactions={summary.transactions} />
                </div>
                <aside className="space-y-6">
                    <div>
                        <AuthorizationInbox
                            title="Autorización Inbox"
                            emptyState={
                                <div
                                    className="rounded-[var(--r-xl)] p-5 flex flex-col items-center gap-2 text-center"
                                    style={{
                                        background: "var(--surf-lowest)",
                                        boxShadow: "var(--shadow)",
                                    }}
                                >
                                    <div
                                        className="text-[0.625rem] font-medium uppercase tracking-[0.05em] mb-1"
                                        style={{ color: "var(--on-surf-var)" }}
                                    >
                                        Autorización Inbox
                                    </div>
                                    <ShieldCheck
                                        className="h-7 w-7"
                                        style={{ color: "var(--on-surf-var)" }}
                                    />
                                    <span
                                        className="text-[0.8125rem]"
                                        style={{ color: "var(--on-surf-var)" }}
                                    >
                                        Sin solicitudes pendientes
                                    </span>
                                </div>
                            }
                        />
                        <div className="mt-3 text-right">
                            <Link
                                href="/autorizaciones"
                                className="text-[0.75rem] hover:underline"
                                style={{ color: "var(--on-surf-var)" }}
                            >
                                Ver historial de autorizaciones
                            </Link>
                        </div>
                    </div>
                    <BalanceByMethodCard
                        byMethod={summary.byMethod}
                        grandTotalCollected={summary.grandTotalCollected}
                    />
                </aside>
            </section>

            <CashFab sessionOpen={true} userRole={user.role} />
        </div>
    );
}

// ── Sub-componentes (Server) ─────────────────────────────────────────────────

function HeroCashCard({
    expectedCash,
    trendPct,
}: {
    expectedCash: number;
    trendPct: number | null;
}): React.ReactElement {
    const isPositive = trendPct !== null && trendPct >= 0;
    return (
        <div
            className="rounded-[var(--r-xl)] p-7"
            style={{
                background: "var(--surf-lowest)",
                boxShadow: "var(--shadow)",
            }}
        >
            <div
                className="text-[0.625rem] font-medium uppercase tracking-[0.08em]"
                style={{ color: "var(--on-surf-var)" }}
            >
                Efectivo en caja
            </div>
            <div
                className="mt-3 text-[3.5rem] font-bold tracking-[-0.02em] leading-none"
                style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--on-surf)",
                }}
            >
                {formatCurrency(expectedCash)}
            </div>
            {trendPct !== null && (
                <div
                    className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-medium"
                    style={{ color: isPositive ? "var(--p)" : "var(--ter)" }}
                >
                    <span aria-hidden>{isPositive ? "↗" : "↘"}</span>
                    {isPositive ? "+" : "−"}
                    {Math.abs(trendPct).toFixed(1)}% respecto al inicio
                </div>
            )}
        </div>
    );
}

function KpiCard({
    label,
    value,
    footer,
    valueColor = "var(--on-surf)",
    valuePrefix = "",
}: {
    label: string;
    value: number;
    footer: string;
    valueColor?: string;
    valuePrefix?: string;
}): React.ReactElement {
    return (
        <div
            className="rounded-[var(--r-xl)] p-6"
            style={{
                background: "var(--surf-lowest)",
                boxShadow: "var(--shadow)",
            }}
        >
            <div
                className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                style={{ color: "var(--on-surf-var)" }}
            >
                {label}
            </div>
            <div
                className="mt-3 text-[1.75rem] font-bold tracking-[-0.02em]"
                style={{
                    fontFamily: "var(--font-display)",
                    color: valueColor,
                }}
            >
                {valuePrefix}
                {formatCurrency(value)}
            </div>
            <div
                className="mt-2 text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
                style={{ color: "var(--on-surf-var)" }}
            >
                {footer}
            </div>
        </div>
    );
}

function DifferenceCard(): React.ReactElement {
    return (
        <div
            className="rounded-[var(--r-xl)] p-6"
            style={{
                background: "var(--surf-lowest)",
                boxShadow: "var(--shadow)",
            }}
        >
            <div
                className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
                style={{ color: "var(--on-surf-var)" }}
            >
                Diferencia actual
            </div>
            <div
                className="mt-3 text-[1.75rem] font-bold tracking-[-0.02em]"
                style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--on-surf-var)",
                }}
            >
                —
            </div>
            <div
                className="mt-2 text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
                style={{ color: "var(--on-surf-var)" }}
            >
                Se calcula al cerrar turno
            </div>
        </div>
    );
}
