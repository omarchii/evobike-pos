import type {
    BankBalanceSnapshot,
    CashExpenseCategory,
    CashTransaction,
    ExpenseCategory,
    OperationalExpense,
    PaymentMethod,
    Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Mapea una `CashExpenseCategory` (gasto en efectivo del turno) a una
 * `ExpenseCategory` (gasto operativo). Se usa solo para agregados del summary
 * de Tesorería — los `CashTransaction` nunca se mutan.
 */
export function mapCashExpenseToOperational(
    cat: CashExpenseCategory | null,
): ExpenseCategory {
    if (!cat) return "OTRO";
    switch (cat) {
        case "MENSAJERIA":
            return "TRANSPORTE";
        case "PAPELERIA":
            return "SERVICIOS";
        case "CONSUMO":
            return "OTRO";
        case "MANTENIMIENTO":
            return "MANTENIMIENTO_INMUEBLE";
        case "PAGO_PROVEEDOR":
            return "OTRO";
        case "LIMPIEZA":
            return "SERVICIOS";
        case "AJUSTE_CAJA":
            return "OTRO";
        case "OTRO":
        default:
            return "OTRO";
    }
}

export function getActiveBankBalance(): Promise<BankBalanceSnapshot | null> {
    return prisma.bankBalanceSnapshot.findFirst({
        orderBy: { createdAt: "desc" },
    });
}

export interface RangeFilter {
    from: Date;
    to: Date;
}

export function getExpensesInRange(
    branchId: string | null,
    range: RangeFilter,
    opts: { incluirAnulados?: boolean } = {},
): Promise<OperationalExpense[]> {
    const where: Prisma.OperationalExpenseWhereInput = {
        fecha: { gte: range.from, lte: range.to },
    };
    if (branchId) where.branchId = branchId;
    if (!opts.incluirAnulados) where.isAnulado = false;
    return prisma.operationalExpense.findMany({
        where,
        orderBy: { fecha: "desc" },
    });
}

export function getCashExpensesInRange(
    branchId: string | null,
    range: RangeFilter,
): Promise<CashTransaction[]> {
    const where: Prisma.CashTransactionWhereInput = {
        type: "EXPENSE_OUT",
        createdAt: { gte: range.from, lte: range.to },
    };
    if (branchId) where.session = { branchId };
    return prisma.cashTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Calcula el rango por defecto del summary: inicio del mes en curso → `now`.
 */
export function getDefaultMonthRange(now: Date = new Date()): RangeFilter {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = now;
    return { from, to };
}

/** Métodos de pago permitidos para `OperationalExpense`. Excluye `CASH`. */
export const OPERATIONAL_EXPENSE_METHODS: readonly PaymentMethod[] = [
    "CARD",
    "TRANSFER",
    "CREDIT_BALANCE",
    "ATRATO",
] as const;
