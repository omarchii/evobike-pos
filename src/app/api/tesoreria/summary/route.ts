import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { ExpenseCategory, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
    getActiveBankBalance,
    getDefaultMonthRange,
    mapCashExpenseToOperational,
} from "@/lib/tesoreria";
import { summarizeSession } from "@/lib/cash-register";
import { parseLocalDate } from "@/lib/reportes/date-range";

interface GastoPorCategoria {
    categoria: ExpenseCategory;
    monto: number;
    porcentaje: number;
}

interface TesoreriaSummaryData {
    rango: { from: string; to: string };
    branchId: string | null;
    ingresos: {
        total: number;
        ventas: number;
    };
    egresos: {
        total: number;
        gastosEfectivo: number;
        gastosOperativos: number;
        comprasProveedor: number;
    };
    balanceNeto: number;
    gastosPorCategoria: GastoPorCategoria[];
    saldoEfectivoCajon: number;
    saldoBancario: number | null;
    saldoBancarioActualizadoEn: string | null;
}

type SummaryResponse =
    | { success: true; data: TesoreriaSummaryData }
    | { success: false; error: string };

const SESSION_INCLUDE = {
    user: { select: { name: true } },
    branch: { select: { name: true } },
    transactions: {
        include: {
            sale: { select: { id: true, folio: true } },
            user: { select: { id: true, name: true } },
        },
    },
} as const satisfies Prisma.CashRegisterSessionInclude;

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

export async function GET(req: NextRequest): Promise<NextResponse<SummaryResponse>> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { success: false, error: "No autorizado" },
            { status: 401 },
        );
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden consultar el resumen de tesorería.",
                },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        const branchParam = searchParams.get("branchId");

        let from: Date;
        let to: Date;
        if (fromParam || toParam) {
            const fromDate = fromParam ? parseLocalDate(fromParam, false) : null;
            const toDate = toParam ? parseLocalDate(toParam, true) : null;
            if ((fromParam && !fromDate) || (toParam && !toDate)) {
                return NextResponse.json(
                    { success: false, error: "Fechas inválidas" },
                    { status: 400 },
                );
            }
            const defaultRange = getDefaultMonthRange();
            from = fromDate ?? defaultRange.from;
            to = toDate ?? defaultRange.to;
        } else {
            const range = getDefaultMonthRange();
            from = range.from;
            to = range.to;
        }

        let effectiveBranchId: string | null;
        if (user.role === "ADMIN") {
            effectiveBranchId =
                branchParam && branchParam.length > 0 ? branchParam : null;
        } else {
            if (branchParam && branchParam !== user.branchId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "No puedes consultar el resumen de otra sucursal.",
                    },
                    { status: 403 },
                );
            }
            effectiveBranchId = user.branchId;
        }

        const saleWhere: Prisma.SaleWhereInput = {
            status: "COMPLETED",
            createdAt: { gte: from, lte: to },
        };
        if (effectiveBranchId) saleWhere.branchId = effectiveBranchId;

        const cashExpenseWhere: Prisma.CashTransactionWhereInput = {
            type: "EXPENSE_OUT",
            createdAt: { gte: from, lte: to },
        };
        if (effectiveBranchId) cashExpenseWhere.session = { branchId: effectiveBranchId };

        const operationalExpenseWhere: Prisma.OperationalExpenseWhereInput = {
            isAnulado: false,
            fecha: { gte: from, lte: to },
        };
        if (effectiveBranchId) operationalExpenseWhere.branchId = effectiveBranchId;

        const purchaseReceiptWhere: Prisma.PurchaseReceiptWhereInput = {
            fechaPago: { not: null, gte: from, lte: to },
        };
        if (effectiveBranchId) purchaseReceiptWhere.branchId = effectiveBranchId;

        const openSessionsWhere: Prisma.CashRegisterSessionWhereInput = {
            status: "OPEN",
        };
        if (effectiveBranchId) openSessionsWhere.branchId = effectiveBranchId;

        const [
            salesAgg,
            cashExpenseAgg,
            operationalExpenseAgg,
            purchaseReceiptAgg,
            operationalExpenseRows,
            cashExpenseRows,
            openSessions,
            bankSnapshot,
        ] = await Promise.all([
            prisma.sale.aggregate({
                _sum: { total: true },
                where: saleWhere,
            }),
            prisma.cashTransaction.aggregate({
                _sum: { amount: true },
                where: cashExpenseWhere,
            }),
            prisma.operationalExpense.aggregate({
                _sum: { monto: true },
                where: operationalExpenseWhere,
            }),
            prisma.purchaseReceipt.aggregate({
                _sum: { totalPagado: true },
                where: purchaseReceiptWhere,
            }),
            prisma.operationalExpense.findMany({
                where: operationalExpenseWhere,
                select: { categoria: true, monto: true },
            }),
            prisma.cashTransaction.findMany({
                where: cashExpenseWhere,
                select: { expenseCategory: true, amount: true },
            }),
            prisma.cashRegisterSession.findMany({
                where: openSessionsWhere,
                include: SESSION_INCLUDE,
            }),
            getActiveBankBalance(),
        ]);

        const ventas = Number(salesAgg._sum.total ?? 0);
        const gastosEfectivo = Number(cashExpenseAgg._sum.amount ?? 0);
        const gastosOperativos = Number(operationalExpenseAgg._sum.monto ?? 0);
        const comprasProveedor = Number(purchaseReceiptAgg._sum.totalPagado ?? 0);

        const egresosTotal = gastosEfectivo + gastosOperativos + comprasProveedor;
        const ingresosTotal = ventas;
        const balanceNeto = ingresosTotal - egresosTotal;

        // Agrupar gastos por categoría (operativos + efectivo).
        const operationalBuckets = operationalExpenseRows.reduce<
            Map<ExpenseCategory, number>
        >((acc, row) => {
            const current = acc.get(row.categoria) ?? 0;
            acc.set(row.categoria, current + Number(row.monto));
            return acc;
        }, new Map<ExpenseCategory, number>());

        const categoriaMap = cashExpenseRows.reduce<Map<ExpenseCategory, number>>(
            (acc, row) => {
                const cat = mapCashExpenseToOperational(row.expenseCategory);
                const current = acc.get(cat) ?? 0;
                acc.set(cat, current + Number(row.amount));
                return acc;
            },
            operationalBuckets,
        );

        const totalGastosCategorizados = gastosEfectivo + gastosOperativos;

        const gastosPorCategoria: GastoPorCategoria[] = Array.from(categoriaMap.entries())
            .filter(([, monto]) => monto > 0)
            .map(([categoria, monto]) => ({
                categoria,
                monto: round2(monto),
                porcentaje:
                    totalGastosCategorizados === 0
                        ? 0
                        : round2((monto / totalGastosCategorizados) * 100),
            }))
            .sort((a, b) => b.monto - a.monto);

        // Saldo efectivo en cajón: suma de expectedCash de sesiones abiertas.
        const saldoEfectivoCajon = openSessions.reduce((acc, sess) => {
            const summary = summarizeSession(sess);
            return acc + summary.expectedCash;
        }, 0);

        const saldoBancario =
            bankSnapshot !== null ? Number(bankSnapshot.monto) : null;
        const saldoBancarioActualizadoEn =
            bankSnapshot !== null ? bankSnapshot.createdAt.toISOString() : null;

        const data: TesoreriaSummaryData = {
            rango: { from: from.toISOString(), to: to.toISOString() },
            branchId: effectiveBranchId,
            ingresos: {
                total: round2(ingresosTotal),
                ventas: round2(ventas),
            },
            egresos: {
                total: round2(egresosTotal),
                gastosEfectivo: round2(gastosEfectivo),
                gastosOperativos: round2(gastosOperativos),
                comprasProveedor: round2(comprasProveedor),
            },
            balanceNeto: round2(balanceNeto),
            gastosPorCategoria,
            saldoEfectivoCajon: round2(saldoEfectivoCajon),
            saldoBancario: saldoBancario !== null ? round2(saldoBancario) : null,
            saldoBancarioActualizadoEn,
        };

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/summary GET]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}
