import type { CashRegisterSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

function isOrphaned(openedAt: Date, now: Date = new Date()): boolean {
    return openedAt.toDateString() !== now.toDateString();
}

export async function getOrphanedSession(branchId: string): Promise<CashRegisterSession | null> {
    const session = await getActiveSession(branchId);
    if (!session) return null;
    return isOrphaned(session.openedAt) ? session : null;
}

export function assertSessionFreshOrThrow(session: CashRegisterSession): void {
    if (isOrphaned(session.openedAt)) {
        throw new OrphanedCashSessionError(session.openedAt);
    }
}
