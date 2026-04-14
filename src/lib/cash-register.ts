import { Prisma } from "@prisma/client";
import type {
    CashDepositCategory,
    CashExpenseCategory,
    CashRegisterSession,
    CashTransactionType,
    CollectionStatus,
    PaymentMethod,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Status de `CashRegisterSession`. En el schema vive como `String @default("OPEN")`
 * (migración enum pendiente para Fase 6). Tipar localmente evita `any` en los
 * callers y documenta el set cerrado.
 */
export type CashSessionStatus = "OPEN" | "CLOSED";

export class OrphanedCashSessionError extends Error {
    readonly openedAt: Date;
    constructor(openedAt: Date) {
        super("CASH_SESSION_ORPHANED");
        this.name = "OrphanedCashSessionError";
        this.openedAt = openedAt;
    }
}

export function getActiveSession(branchId: string): Promise<CashRegisterSession | null> {
    return prisma.cashRegisterSession.findFirst({
        where: { branchId, status: "OPEN" },
    });
}

/**
 * Una sesión es huérfana si está OPEN y se abrió en un día calendario distinto al de
 * `now`. Sesiones CLOSED nunca son huérfanas. Acepta el mínimo necesario para poder
 * reusarse desde contextos que solo leen `findFirst` básico (banner del layout).
 */
export function isSessionOrphaned(
    session: { openedAt: Date; status: CashSessionStatus | string },
    now: Date = new Date(),
): boolean {
    if (session.status !== "OPEN") return false;
    return session.openedAt.toDateString() !== now.toDateString();
}

export async function getOrphanedSession(branchId: string): Promise<CashRegisterSession | null> {
    const session = await getActiveSession(branchId);
    if (!session) return null;
    return isSessionOrphaned(session) ? session : null;
}

export function assertSessionFreshOrThrow(session: CashRegisterSession): void {
    if (isSessionOrphaned(session)) {
        throw new OrphanedCashSessionError(session.openedAt);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// summarizeSession — agregación server-side para /cash-register
// ─────────────────────────────────────────────────────────────────────────────

export type SerializedCashTransaction = {
    id: string;
    createdAt: string;
    type: CashTransactionType;
    method: PaymentMethod;
    amount: number;
    reference: string | null;
    beneficiary: string | null;
    notes: string | null;
    collectionStatus: CollectionStatus;
    collectedAt: string | null;
    expenseCategory: CashExpenseCategory | null;
    depositCategory: CashDepositCategory | null;
    saleId: string | null;
    saleFolio: string | null;
};

export type MethodSummary = {
    method: PaymentMethod;
    collected: number;
    pending: number;
    count: number;
};

export type SessionSummary = {
    sessionId: string;
    branchId: string;
    branchName: string;
    openedAt: string;
    openedByName: string;
    openingAmt: number;
    isOrphaned: boolean;

    expectedCash: number;
    cashTrendPct: number | null;

    paymentsInTotal: number;
    paymentsInCount: number;
    outflowTotal: number;
    outflowCount: number;

    byMethod: MethodSummary[];
    grandTotalCollected: number;

    salesCash: number;
    depositsCash: number;
    expensesCash: number;
    withdrawalsCash: number;
    refundsCash: number;

    transactions: SerializedCashTransaction[];
};

/**
 * Shape esperado por `summarizeSession`. Lo declaramos con `GetPayload` para que
 * el caller (page.tsx) reciba ayuda del typechecker al construir el query.
 */
export type SessionWithDetails = Prisma.CashRegisterSessionGetPayload<{
    include: {
        user: { select: { name: true } };
        branch: { select: { name: true } };
        transactions: {
            include: { sale: { select: { id: true; folio: true } } };
        };
    };
}>;

/** Orden canónico de métodos de pago para render del panel "Balance por Método". */
const METHOD_ORDER: readonly PaymentMethod[] = [
    "CASH",
    "CARD",
    "TRANSFER",
    "CREDIT_BALANCE",
    "ATRATO",
] as const;

function toAmount(value: Prisma.Decimal | number | string, context: string): number {
    const n = Number(value);
    if (Number.isNaN(n)) {
        throw new Error(`Invalid decimal amount in ${context}: ${String(value)}`);
    }
    return n;
}

export function summarizeSession(session: SessionWithDetails): SessionSummary {
    const openingAmt = toAmount(session.openingAmt, `session ${session.id} openingAmt`);

    let paymentsInTotal = 0;
    let paymentsInCount = 0;
    let outflowTotal = 0;
    let outflowCount = 0;

    let salesCash = 0;
    let depositsCash = 0;
    let expensesCash = 0;
    let withdrawalsCash = 0;
    let refundsCash = 0;

    const methodBuckets = new Map<PaymentMethod, MethodSummary>();
    const ensureBucket = (method: PaymentMethod): MethodSummary => {
        const existing = methodBuckets.get(method);
        if (existing) return existing;
        const fresh: MethodSummary = { method, collected: 0, pending: 0, count: 0 };
        methodBuckets.set(method, fresh);
        return fresh;
    };

    const transactions: SerializedCashTransaction[] = session.transactions.map((tx) => {
        const amount = toAmount(tx.amount, `tx ${tx.id}`);

        if (tx.type === "PAYMENT_IN") {
            const bucket = ensureBucket(tx.method);
            bucket.count += 1;
            if (tx.collectionStatus === "COLLECTED") {
                bucket.collected += amount;
                paymentsInTotal += amount;
                paymentsInCount += 1;
                if (tx.method === "CASH") salesCash += amount;
            } else {
                bucket.pending += amount;
            }
        } else if (tx.type === "CASH_DEPOSIT") {
            depositsCash += amount;
        } else if (tx.type === "EXPENSE_OUT") {
            outflowTotal += amount;
            outflowCount += 1;
            if (tx.method === "CASH") expensesCash += amount;
        } else if (tx.type === "WITHDRAWAL") {
            outflowTotal += amount;
            outflowCount += 1;
            withdrawalsCash += amount;
        } else if (tx.type === "REFUND_OUT") {
            outflowTotal += amount;
            outflowCount += 1;
            if (tx.method === "CASH") refundsCash += amount;
        }

        return {
            id: tx.id,
            createdAt: tx.createdAt.toISOString(),
            type: tx.type,
            method: tx.method,
            amount,
            reference: tx.reference,
            beneficiary: tx.beneficiary,
            notes: tx.notes,
            collectionStatus: tx.collectionStatus,
            collectedAt: tx.collectedAt ? tx.collectedAt.toISOString() : null,
            expenseCategory: tx.expenseCategory,
            depositCategory: tx.depositCategory,
            saleId: tx.saleId,
            saleFolio: tx.sale?.folio ?? null,
        };
    });

    transactions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const expectedCash =
        openingAmt + salesCash + depositsCash - expensesCash - withdrawalsCash - refundsCash;
    const cashTrendPct =
        openingAmt > 0 ? ((expectedCash - openingAmt) / openingAmt) * 100 : null;

    const byMethod: MethodSummary[] = METHOD_ORDER
        .map((m) => methodBuckets.get(m))
        .filter((b): b is MethodSummary => !!b && b.count > 0);

    const grandTotalCollected = byMethod.reduce((acc, b) => acc + b.collected, 0);

    return {
        sessionId: session.id,
        branchId: session.branchId,
        branchName: session.branch.name,
        openedAt: session.openedAt.toISOString(),
        openedByName: session.user.name,
        openingAmt,
        isOrphaned: isSessionOrphaned(session),

        expectedCash,
        cashTrendPct,

        paymentsInTotal,
        paymentsInCount,
        outflowTotal,
        outflowCount,

        byMethod,
        grandTotalCollected,

        salesCash,
        depositsCash,
        expensesCash,
        withdrawalsCash,
        refundsCash,

        transactions,
    };
}
