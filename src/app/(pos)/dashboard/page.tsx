import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ManagerDashboard } from "./manager-dashboard";
import { SellerDashboard } from "./seller-dashboard";
import { TechnicianDashboard } from "./technician-dashboard";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}


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

    // === SELLER branch ===
    if (role === "SELLER") {
        const userId = user?.id ?? "";

        const sellerSalesAgg = await prisma.sale.aggregate({
            where: {
                userId,
                status: "COMPLETED",
                createdAt: { gte: startOfDay, lte: endOfDay },
            },
            _sum: { total: true },
            _count: { id: true },
        });

        const activeLayawaysCountSeller = await prisma.sale.count({
            where: { userId, status: "LAYAWAY" },
        });

        const sellerSession = await prisma.cashRegisterSession.findFirst({
            where: { userId, ...(branchId ? { branchId } : {}), status: "OPEN" },
            select: { id: true, openingAmt: true },
        });

        const openSessionId = sellerSession?.id ?? null;

        const recentSellerSalesPrisma = await prisma.sale.findMany({
            where: {
                userId,
                status: "COMPLETED",
            },
            orderBy: { createdAt: "desc" },
            take: 10,
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
                            },
                        },
                    },
                },
                payments: {
                    take: 1,
                    orderBy: { createdAt: "asc" },
                    select: { method: true },
                },
            },
        });

        const sellerLayawaysPrisma = await prisma.sale.findMany({
            where: { userId, status: "LAYAWAY" },
            select: {
                id: true,
                folio: true,
                total: true,
                customer: { select: { name: true } },
                payments: { select: { amount: true } },
            },
        });

        const atratoSellerPrisma = openSessionId
            ? await prisma.cashTransaction.findMany({
                  where: {
                      sessionId: openSessionId,
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
              })
            : [];

        const recentSales = recentSellerSalesPrisma.map((s) => ({
            id: s.id,
            folio: s.folio,
            total: Number(s.total),
            createdAt: s.createdAt,
            mainProduct: s.items[0]?.productVariant?.modelo.nombre ?? null,
            paymentMethod: s.payments[0]?.method ?? null,
        }));

        const layaways = sellerLayawaysPrisma.map((l) => {
            const paid = l.payments.reduce((acc, p) => acc + Number(p.amount), 0);
            return {
                id: l.id,
                folio: l.folio,
                total: Number(l.total),
                customerName: l.customer?.name ?? null,
                pendingAmount: Number(l.total) - paid,
            };
        });

        const atratoRows = atratoSellerPrisma.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            saleForlio: t.sale?.folio ?? null,
            diasPendiente: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
        }));

        return (
            <SellerDashboard
                branchName={branchName}
                salesTodayCount={sellerSalesAgg._count.id}
                revenueToday={Number(sellerSalesAgg._sum.total ?? 0)}
                activeLayawaysCount={activeLayawaysCountSeller}
                cashSession={{
                    isOpen: sellerSession !== null,
                    openingAmt: sellerSession ? Number(sellerSession.openingAmt) : 0,
                }}
                recentSales={recentSales}
                layaways={layaways}
                atratoRows={atratoRows}
            />
        );
    }

    // === TECHNICIAN branch ===
    if (role === "TECHNICIAN") {
        const activeOrdersCountTech = await prisma.serviceOrder.count({
            where: {
                ...(branchId ? { branchId } : {}),
                status: { in: ["PENDING", "IN_PROGRESS"] },
            },
        });

        const readyOrdersCountTech = await prisma.serviceOrder.count({
            where: {
                ...(branchId ? { branchId } : {}),
                status: "COMPLETED",
            },
        });

        const deliveredTodayCountTech = await prisma.serviceOrder.count({
            where: {
                ...(branchId ? { branchId } : {}),
                status: "DELIVERED",
                updatedAt: { gte: startOfDay },
            },
        });

        const activeOrdersPrisma = await prisma.serviceOrder.findMany({
            where: {
                ...(branchId ? { branchId } : {}),
                status: { in: ["PENDING", "IN_PROGRESS"] },
            },
            orderBy: { createdAt: "asc" },
            take: 10,
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

        const readyOrdersPrisma = await prisma.serviceOrder.findMany({
            where: {
                ...(branchId ? { branchId } : {}),
                status: "COMPLETED",
            },
            orderBy: { updatedAt: "desc" },
            take: 8,
            select: {
                id: true,
                folio: true,
                bikeInfo: true,
                customer: { select: { name: true } },
                customerBike: { select: { model: true } },
            },
        });

        const allBikes = await prisma.customerBike.findMany({
            where: branchId ? { branchId } : {},
            select: {
                id: true,
                model: true,
                voltaje: true,
                customer: { select: { name: true } },
                serviceOrders: {
                    where: { status: { in: ["COMPLETED", "DELIVERED"] } },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { createdAt: true, status: true },
                },
            },
        });

        const MAINTENANCE_THRESHOLD_DAYS = 150;
        const maintenanceAlerts = allBikes
            .filter((bike) => {
                const lastOrder = bike.serviceOrders[0];
                if (!lastOrder) return true;
                const dias = Math.floor(
                    (now.getTime() - lastOrder.createdAt.getTime()) / 86400000
                );
                return dias > MAINTENANCE_THRESHOLD_DAYS;
            })
            .map((bike) => {
                const lastOrder = bike.serviceOrders[0];
                return {
                    bikeId: bike.id,
                    bikeModel: bike.model ?? null,
                    bikeVoltaje: bike.voltaje ?? null,
                    customerName: bike.customer?.name ?? "Sin cliente",
                    lastServiceDate: lastOrder?.createdAt ?? null,
                    diasDesdeServicio: lastOrder
                        ? Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / 86400000)
                        : 999,
                };
            })
            .sort((a, b) => b.diasDesdeServicio - a.diasDesdeServicio)
            .slice(0, 10);

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

        const readyOrders = readyOrdersPrisma.map((o) => ({
            id: o.id,
            folio: o.folio,
            customerName: o.customer.name,
            bikeInfo: o.bikeInfo ?? o.customerBike?.model ?? null,
        }));

        return (
            <TechnicianDashboard
                branchName={branchName}
                activeOrdersCount={activeOrdersCountTech}
                readyOrdersCount={readyOrdersCountTech}
                deliveredTodayCount={deliveredTodayCountTech}
                activeOrders={activeOrders}
                readyOrders={readyOrders}
                maintenanceAlerts={maintenanceAlerts}
            />
        );
    }

    // === Fallback para roles no reconocidos ===
    return (
        <div className="flex items-center justify-center h-64">
            <p className="text-sm text-zinc-500">Rol no reconocido: {role}</p>
        </div>
    );
}
