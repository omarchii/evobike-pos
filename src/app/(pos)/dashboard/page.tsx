import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrendingUp, Banknote, Wrench, ArchiveRestore } from "lucide-react";
import { ManagerDashboard } from "./manager-dashboard";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}

const WORKSHOP_STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En Proceso",
    COMPLETED: "Completado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as unknown as SessionUser;
    const role = user?.role ?? "SELLER";
    const branchId = user?.branchId ?? null;
    const branchName = user?.branchName ?? "la Sucursal";

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // === MANAGER / ADMIN branch ===
    if (role === "MANAGER" || role === "ADMIN") {
        const viewBranchId = branchId;

        // Step 1: Get open session IDs for this branch (or all if ADMIN)
        const openSessions = await prisma.cashRegisterSession.findMany({
            where: viewBranchId
                ? { branchId: viewBranchId, status: "OPEN" }
                : { status: "OPEN" },
            select: { id: true, openingAmt: true },
        });
        const openSessionIds = openSessions.map((s) => s.id);

        // Step 2: CASH inflows
        const cashIn = await prisma.cashTransaction.aggregate({
            where: {
                sessionId: { in: openSessionIds },
                type: "PAYMENT_IN",
                method: "CASH",
            },
            _sum: { amount: true },
        });

        // Step 3: CASH outflows
        const cashOut = await prisma.cashTransaction.aggregate({
            where: {
                sessionId: { in: openSessionIds },
                type: { in: ["REFUND_OUT", "EXPENSE_OUT", "WITHDRAWAL"] },
                method: "CASH",
            },
            _sum: { amount: true },
        });

        // Step 4: Calculate
        const openingTotal = openSessions.reduce((s, sess) => s + Number(sess.openingAmt), 0);
        const cashInRegister =
            openingTotal +
            Number(cashIn._sum.amount ?? 0) -
            Number(cashOut._sum.amount ?? 0);

        // Revenue + transactions today
        const revenueAgg = await prisma.sale.aggregate({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "COMPLETED",
                createdAt: { gte: startOfDay, lte: endOfDay },
            },
            _sum: { total: true },
            _count: { id: true },
        });
        const revenueToday = Number(revenueAgg._sum.total ?? 0);
        const transactionsToday = revenueAgg._count.id;

        // Layaways pending amount
        const layawaysPrisma = await prisma.sale.findMany({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "LAYAWAY",
            },
            select: {
                id: true,
                total: true,
                payments: { select: { amount: true } },
            },
        });
        const activeLayawaysCount = layawaysPrisma.length;
        const pendingLayawayAmount = layawaysPrisma.reduce((acc, l) => {
            const paid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
            return acc + (Number(l.total) - paid);
        }, 0);

        // Branch comparison (always both branches)
        const allBranches = await prisma.branch.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
        });
        const branchComparison = await Promise.all(
            allBranches.map(async (b) => {
                const agg = await prisma.sale.aggregate({
                    where: {
                        branchId: b.id,
                        status: "COMPLETED",
                        createdAt: { gte: startOfDay, lte: endOfDay },
                    },
                    _sum: { total: true },
                    _count: { id: true },
                });
                return {
                    branchId: b.id,
                    branchCode: b.code,
                    branchName: b.name,
                    revenue: Number(agg._sum.total ?? 0),
                    transactions: agg._count.id,
                };
            })
        );

        // Recent sales today (last 15)
        const recentSalesPrisma = await prisma.sale.findMany({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "COMPLETED",
                createdAt: { gte: startOfDay },
            },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
                id: true,
                folio: true,
                total: true,
                createdAt: true,
                items: {
                    take: 1,
                    select: {
                        productVariant: {
                            select: {
                                modelo: { select: { nombre: true } },
                                voltaje: { select: { label: true } },
                            },
                        },
                    },
                },
                user: { select: { name: true } },
                payments: {
                    take: 1,
                    orderBy: { createdAt: "asc" },
                    select: { method: true },
                },
            },
        });

        // Active workshop orders
        const activeOrdersPrisma = await prisma.serviceOrder.findMany({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: { in: ["PENDING", "IN_PROGRESS"] },
            },
            orderBy: { createdAt: "asc" },
            take: 8,
            select: {
                id: true,
                folio: true,
                status: true,
                createdAt: true,
                bikeInfo: true,
                customer: { select: { name: true } },
                customerBike: { select: { model: true, voltaje: true } },
            },
        });

        // Atrato pending
        const atratoTxPrisma = await prisma.cashTransaction.findMany({
            where: {
                sessionId: { in: openSessionIds.length > 0 ? openSessionIds : ["__none__"] },
                method: "ATRATO",
                collectionStatus: "PENDING",
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                createdAt: true,
                sale: { select: { folio: true } },
            },
        });

        // Pending commissions this month
        const commissionsPrisma = await prisma.commissionRecord.findMany({
            where: {
                status: "PENDING",
                createdAt: { gte: startOfMonth },
                ...(viewBranchId ? { user: { branchId: viewBranchId } } : {}),
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                createdAt: true,
                user: { select: { name: true, role: true } },
                sale: { select: { folio: true, total: true } },
            },
        });

        // Serialize: Decimals to number
        const recentSales = recentSalesPrisma.map((s) => ({
            id: s.id,
            folio: s.folio,
            total: Number(s.total),
            createdAt: s.createdAt,
            mainProduct: s.items[0]?.productVariant?.modelo.nombre ?? null,
            mainProductVoltaje: s.items[0]?.productVariant?.voltaje.label ?? null,
            vendedor: s.user.name,
            paymentMethod: s.payments[0]?.method ?? null,
        }));

        const activeOrders = activeOrdersPrisma.map((o) => ({
            id: o.id,
            folio: o.folio,
            status: o.status,
            createdAt: o.createdAt,
            customerName: o.customer.name,
            bikeInfo: o.bikeInfo ?? o.customerBike?.model ?? null,
            bikeVoltaje: o.customerBike?.voltaje ?? null,
            minutosTranscurridos: Math.floor((now.getTime() - o.createdAt.getTime()) / 60000),
        }));

        const atratiPendientes = atratoTxPrisma.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            createdAt: t.createdAt,
            saleForlio: t.sale?.folio ?? null,
            diasPendiente: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
        }));

        const pendingCommissions = commissionsPrisma.map((c) => ({
            id: c.id,
            amount: Number(c.amount),
            createdAt: c.createdAt,
            userName: c.user.name,
            userRole: c.user.role,
            saleForlio: c.sale.folio,
            saleTotal: Number(c.sale.total),
        }));

        const atratoTotal = atratiPendientes.reduce((s, t) => s + t.amount, 0);
        const commissionsTotal = pendingCommissions.reduce((s, c) => s + c.amount, 0);

        return (
            <ManagerDashboard
                role={role}
                branchName={branchName}
                revenueToday={revenueToday}
                transactionsToday={transactionsToday}
                cashInRegister={cashInRegister}
                activeLayawaysCount={activeLayawaysCount}
                pendingLayawayAmount={pendingLayawayAmount}
                branchComparison={branchComparison}
                recentSales={recentSales}
                activeOrders={activeOrders}
                atratiPendientes={atratiPendientes}
                atratoTotal={atratoTotal}
                pendingCommissions={pendingCommissions}
                commissionsTotal={commissionsTotal}
            />
        );
    }

    // === SELLER / TECHNICIAN branch (basic dashboard) ===
    const salesTodayAgg = await prisma.sale.aggregate({
        where: {
            ...(branchId ? { branchId } : {}),
            createdAt: { gte: startOfDay, lte: endOfDay },
            status: "COMPLETED",
        },
        _sum: { total: true },
    });
    const revenueToday = Number(salesTodayAgg._sum.total ?? 0);

    const activeWorkshopCount = await prisma.serviceOrder.count({
        where: {
            ...(branchId ? { branchId } : {}),
            status: { in: ["PENDING", "IN_PROGRESS"] },
        },
    });

    const activeLayawaysCount = await prisma.sale.count({
        where: {
            ...(branchId ? { branchId } : {}),
            status: "LAYAWAY",
        },
    });

    const salesTodayCount = await prisma.sale.count({
        where: {
            ...(branchId ? { branchId } : {}),
            status: "COMPLETED",
            createdAt: { gte: startOfDay, lte: endOfDay },
        },
    });

    const recentSalesBasic = await prisma.sale.findMany({
        where: { ...(branchId ? { branchId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, user: true },
    });

    const upcomingOrders = await prisma.serviceOrder.findMany({
        where: {
            ...(branchId ? { branchId } : {}),
            status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { customer: true },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Resumen diario · {branchName}</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Ventas Hoy */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 space-y-3 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ventas Hoy</span>
                        <TrendingUp className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                        {salesTodayCount}{" "}
                        <span className="text-lg font-normal text-zinc-400">unidades</span>
                    </p>
                    <p className="text-xs text-zinc-400">Ventas cobradas hoy</p>
                </div>

                {/* Ingresos del Día */}
                <div className="bg-green-500 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                            Ingresos del Día
                        </span>
                        <Banknote className="h-4 w-4 text-white/60" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        ${revenueToday.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-white/50">Total facturado hoy</p>
                </div>

                {/* Taller Activo */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 space-y-3 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Taller Activo</span>
                        <Wrench className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                        {String(activeWorkshopCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-400">órdenes</span>
                    </p>
                    <p className="text-xs text-zinc-400">Pendientes / En proceso</p>
                </div>

                {/* Apartados */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 space-y-3 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Apartados</span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                        {String(activeLayawaysCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-400">tickets</span>
                    </p>
                    <p className="text-xs text-zinc-400">Por liquidar</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-7 gap-4">
                {/* Revenue Trend */}
                <div className="col-span-4 bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                Tendencia de Ingresos
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Análisis de rendimiento semanal
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                                Semana
                            </button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                                Mes
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-56 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-zinc-400 text-sm">El gráfico se activará en v2</p>
                    </div>
                </div>

                {/* Right column */}
                <div className="col-span-3 space-y-4">
                    {/* Ventas Recientes */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                            Ventas Recientes
                        </h2>
                        {recentSalesBasic.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-4">
                                No hay ventas registradas aún.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentSalesBasic.map((sale) => {
                                    const initials = sale.customer
                                        ? sale.customer.name.substring(0, 2).toUpperCase()
                                        : "MO";
                                    return (
                                        <div key={sale.id} className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-500 shrink-0">
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                    {sale.customer?.name ?? "Mostrador"}
                                                </p>
                                                <p className="text-xs text-zinc-400 truncate">
                                                    {sale.folio} ·{" "}
                                                    {new Date(sale.createdAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                                    +${Number(sale.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Próximas Órdenes de Taller */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                            Próximas Órdenes de Taller
                        </h2>
                        {upcomingOrders.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-4">
                                No hay órdenes activas.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingOrders.map((order) => {
                                    const d = new Date(order.createdAt);
                                    const day = d.getDate();
                                    const month = d.toLocaleString("es-MX", { month: "short" }).toUpperCase();
                                    return (
                                        <div key={order.id} className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] font-medium text-zinc-400 leading-none">
                                                    {month}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 leading-tight">
                                                    {day}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                    {order.bikeInfo ?? order.diagnosis ?? order.folio}
                                                </p>
                                                <p className="text-xs text-zinc-400 truncate">
                                                    {order.customer?.name ?? "Sin cliente"} · {order.folio}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                                    order.status === "IN_PROGRESS"
                                                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                                }`}
                                            >
                                                {WORKSHOP_STATUS_LABELS[order.status as string] ?? order.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
