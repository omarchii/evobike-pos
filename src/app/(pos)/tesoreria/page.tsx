import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    getActiveBankBalance,
    getCashExpensesInRange,
    getDefaultMonthRange,
    getExpensesInRange,
    mapCashExpenseToOperational,
} from "@/lib/tesoreria";
import { summarizeSession } from "@/lib/cash-register";
import type { ExpenseCategory } from "@prisma/client";
import { Landmark } from "lucide-react";
import { SaldosCards } from "./saldos-cards";
import { GastosControls } from "./gastos-controls";
import { GastosTabla, type TableRow } from "./gastos-tabla";
import { ReportesPeriodo } from "./reportes-periodo";
import { EXPENSE_CATEGORIES, type ExpenseCategoryTuple } from "./shared-tokens";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

function parseDateParam(v: string | undefined): Date | null {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function toDateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function isExpenseCategory(v: string | undefined): v is ExpenseCategoryTuple {
    return !!v && (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

interface SearchParams {
    from?: string;
    to?: string;
    categoria?: string;
    branchId?: string;
    soloSinComprobante?: string;
}

export default async function TesoreriaPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    const user = session.user as SessionUser;
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
        redirect("/");
    }

    const isAdmin = user.role === "ADMIN";
    const params = await searchParams;

    // ── Rango ────────────────────────────────────────────────────────────
    const defaults = getDefaultMonthRange();
    const fromDate = parseDateParam(params.from) ?? defaults.from;
    const toRaw = parseDateParam(params.to) ?? defaults.to;
    const toDate = new Date(toRaw);
    toDate.setHours(23, 59, 59, 999);

    // ── Filtro de sucursal ──────────────────────────────────────────────
    const filterCategoria = isExpenseCategory(params.categoria)
        ? params.categoria
        : null;
    const filterBranchIdRaw = params.branchId ?? "";
    const effectiveBranchId = isAdmin
        ? filterBranchIdRaw || null
        : user.branchId;
    const soloSinComprobante = params.soloSinComprobante === "true";

    // ── Branches para filtro del ADMIN y default del modal ──────────────
    const branches = await prisma.branch.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    // ── Queries en paralelo ─────────────────────────────────────────────
    const [
        operationalExpensesRaw,
        cashExpensesRaw,
        openSessions,
        bankBalance,
        ventasAgg,
        comprasAgg,
    ] = await Promise.all([
        getExpensesInRange(
            effectiveBranchId,
            { from: fromDate, to: toDate },
            { incluirAnulados: true },
        ),
        getCashExpensesInRange(effectiveBranchId, {
            from: fromDate,
            to: toDate,
        }),
        prisma.cashRegisterSession.findMany({
            where: {
                status: "OPEN",
                ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            include: {
                user: { select: { name: true } },
                branch: { select: { name: true } },
                transactions: {
                    include: {
                        sale: { select: { id: true, folio: true } },
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        }),
        getActiveBankBalance(),
        prisma.sale.aggregate({
            _sum: { total: true },
            where: {
                status: "COMPLETED",
                createdAt: { gte: fromDate, lte: toDate },
                ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
        }),
        prisma.purchaseReceipt.aggregate({
            _sum: { totalPagado: true },
            where: {
                fechaPago: { gte: fromDate, lte: toDate, not: null },
                ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
        }),
    ]);

    // ── Registrado-by para cada gasto operativo ─────────────────────────
    const registradoByIds = Array.from(
        new Set(operationalExpensesRaw.map((e) => e.registradoPor)),
    );
    const users = registradoByIds.length
        ? await prisma.user.findMany({
              where: { id: { in: registradoByIds } },
              select: { id: true, name: true },
          })
        : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));

    // ── Filtros adicionales sobre operational expenses ──────────────────
    const operationalExpenses = operationalExpensesRaw.filter((e) => {
        if (filterCategoria && e.categoria !== filterCategoria) return false;
        if (soloSinComprobante && e.comprobanteUrl) return false;
        return true;
    });

    // ── Rows para la tabla ──────────────────────────────────────────────
    const opRows: TableRow[] = operationalExpenses.map((e) => ({
        kind: "operational",
        id: e.id,
        fechaISO: e.fecha.toISOString(),
        categoria: e.categoria as ExpenseCategoryTuple,
        descripcion: e.descripcion,
        metodo: e.metodoPago,
        monto: Number(e.monto),
        comprobanteUrl: e.comprobanteUrl,
        isAnulado: e.isAnulado,
        motivoAnulacion: e.motivoAnulacion,
        branchId: e.branchId,
        createdAtISO: e.createdAt.toISOString(),
        registradoByName: userNameById.get(e.registradoPor) ?? null,
    }));

    const cashRowsUnfiltered: TableRow[] = cashExpensesRaw.map((tx) => ({
        kind: "cash",
        id: tx.id,
        fechaISO: tx.createdAt.toISOString(),
        categoria: mapCashExpenseToOperational(
            tx.expenseCategory,
        ) as ExpenseCategoryTuple,
        descripcion: tx.notes ?? tx.beneficiary ?? "Gasto en efectivo",
        metodo: tx.method,
        monto: Number(tx.amount),
        comprobanteUrl: null,
        isAnulado: false,
        motivoAnulacion: null,
        branchId: null,
        createdAtISO: tx.createdAt.toISOString(),
        registradoByName: null,
    }));
    const cashRows = cashRowsUnfiltered.filter((r) => {
        if (filterCategoria && r.categoria !== filterCategoria) return false;
        if (soloSinComprobante) return true; // siempre sin comprobante
        return true;
    });

    const rows: TableRow[] = [...opRows, ...cashRows].sort((a, b) =>
        a.fechaISO < b.fechaISO ? 1 : -1,
    );

    // ── Agregados del summary ───────────────────────────────────────────
    const gastosOperativosTotal = operationalExpensesRaw
        .filter((e) => !e.isAnulado)
        .reduce((acc, e) => acc + Number(e.monto), 0);
    const gastosEfectivoTotal = cashExpensesRaw.reduce(
        (acc, tx) => acc + Number(tx.amount),
        0,
    );
    const ventasTotal = Number(ventasAgg._sum.total ?? 0);
    const comprasTotal = Number(comprasAgg._sum.totalPagado ?? 0);
    const egresosTotal =
        gastosOperativosTotal + gastosEfectivoTotal + comprasTotal;
    const balanceNeto = ventasTotal - egresosTotal;

    // ── Gastos por categoría (unifica operational + cash mapeado) ──────
    const totalesCategoria = new Map<ExpenseCategory, number>();
    for (const e of operationalExpensesRaw) {
        if (e.isAnulado) continue;
        const cur = totalesCategoria.get(e.categoria) ?? 0;
        totalesCategoria.set(e.categoria, cur + Number(e.monto));
    }
    for (const tx of cashExpensesRaw) {
        const cat = mapCashExpenseToOperational(tx.expenseCategory);
        const cur = totalesCategoria.get(cat) ?? 0;
        totalesCategoria.set(cat, cur + Number(tx.amount));
    }
    const denominador = gastosEfectivoTotal + gastosOperativosTotal;
    const gastosPorCategoria = Array.from(totalesCategoria.entries())
        .filter(([, monto]) => monto > 0)
        .map(([categoria, monto]) => ({
            categoria: categoria as ExpenseCategoryTuple,
            monto,
            porcentaje:
                denominador > 0
                    ? Math.round((monto / denominador) * 10000) / 100
                    : 0,
        }))
        .sort((a, b) => b.monto - a.monto);

    // ── Saldo efectivo en cajón ─────────────────────────────────────────
    const saldoEfectivoCajon = openSessions.reduce(
        (acc, s) => acc + summarizeSession(s).expectedCash,
        0,
    );

    // ── Saldo bancario ──────────────────────────────────────────────────
    const saldoBancario = bankBalance ? Number(bankBalance.monto) : null;
    const saldoBancarioActualizadoEn = bankBalance
        ? bankBalance.createdAt.toISOString()
        : null;

    const todayStr = toDateOnly(new Date());

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="min-w-0">
                    <h1
                        className="text-[2.25rem] lg:text-[2.75rem] font-bold tracking-[-0.01em] leading-none flex items-center gap-3"
                        style={{
                            fontFamily: "var(--font-display)",
                            color: "var(--on-surf)",
                        }}
                    >
                        <Landmark
                            className="h-8 w-8"
                            style={{ color: "var(--on-surf-var)" }}
                        />
                        Tesorería
                    </h1>
                    <p
                        className="mt-2 text-[0.8125rem]"
                        style={{ color: "var(--on-surf-var)" }}
                    >
                        Gastos operativos, saldos y balance del período.
                    </p>
                </div>
            </header>

            <SaldosCards
                saldoEfectivoCajon={saldoEfectivoCajon}
                saldoBancario={saldoBancario}
                saldoBancarioActualizadoEn={saldoBancarioActualizadoEn}
                isAdmin={isAdmin}
            />

            <GastosControls
                isAdmin={isAdmin}
                branches={branches}
                defaultBranchId={user.branchId}
                currentFrom={toDateOnly(fromDate)}
                currentTo={toDateOnly(toRaw)}
                currentCategoria={filterCategoria ?? ""}
                currentBranchId={filterBranchIdRaw}
                currentSoloSinComprobante={soloSinComprobante}
            />

            <GastosTabla
                rows={rows}
                isAdmin={isAdmin}
                userBranchId={user.branchId}
                todayStr={todayStr}
            />

            <ReportesPeriodo
                ingresos={ventasTotal}
                egresos={egresosTotal}
                balanceNeto={balanceNeto}
                gastosPorCategoria={gastosPorCategoria}
            />
        </div>
    );
}
