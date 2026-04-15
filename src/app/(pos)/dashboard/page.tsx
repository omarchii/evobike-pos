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

type PeriodType = "today" | "week" | "month";

function parsePeriod(searchParams: Record<string, string | string[] | undefined>): {
    period: PeriodType;
    from: Date;
    to: Date;
    compFrom: Date;
    compTo: Date;
    periodLabel: string;
    compLabel: string;
} {
    const raw = typeof searchParams.period === "string" ? searchParams.period : "today";
    const period = (["today", "week", "month"].includes(raw) ? raw : "today") as PeriodType;

    const now = new Date();
    let from: Date;
    let to: Date;
    let compFrom: Date;
    let compTo: Date;
    let periodLabel: string;
    let compLabel: string;

    if (period === "week") {
        const dayOfWeek = now.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        from = new Date(now);
        from.setDate(now.getDate() - mondayOffset);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        // Comparison: previous week
        compFrom = new Date(from);
        compFrom.setDate(compFrom.getDate() - 7);
        compTo = new Date(from);
        compTo.setMilliseconds(-1);
        periodLabel = "esta semana";
        compLabel = "vs semana pasada";
    } else if (period === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        // Comparison: previous month (same number of days)
        compFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        compTo = new Date(compFrom);
        const daysSoFar = now.getDate();
        compTo.setDate(compFrom.getDate() + daysSoFar - 1);
        compTo.setHours(23, 59, 59, 999);
        periodLabel = "este mes";
        compLabel = "vs mes pasado";
    } else {
        // today
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        compFrom = new Date(now);
        compFrom.setDate(compFrom.getDate() - 1);
        compFrom.setHours(0, 0, 0, 0);
        compTo = new Date(now);
        compTo.setDate(compTo.getDate() - 1);
        compTo.setHours(23, 59, 59, 999);
        periodLabel = "hoy";
        compLabel = "vs ayer";
    }

    return { period, from, to, compFrom, compTo, periodLabel, compLabel };
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Period parsing for manager dashboard
    const resolvedParams = await searchParams;
    const periodInfo = parsePeriod(resolvedParams);

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

        // Revenue + transactions for selected period
        const revenueAgg = await prisma.sale.aggregate({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "COMPLETED",
                createdAt: { gte: periodInfo.from, lte: periodInfo.to },
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
                        createdAt: { gte: periodInfo.from, lte: periodInfo.to },
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

        // Recent sales in period (last 15)
        const recentSalesPrisma = await prisma.sale.findMany({
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "COMPLETED",
                createdAt: { gte: periodInfo.from, lte: periodInfo.to },
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
                sale: { select: { id: true, folio: true } },
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
                sale: { select: { id: true, folio: true, total: true } },
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
            saleId: t.sale?.id ?? null,
            saleForlio: t.sale?.folio ?? null,
            diasPendiente: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
        }));

        const pendingCommissions = commissionsPrisma.map((c) => ({
            id: c.id,
            amount: Number(c.amount),
            createdAt: c.createdAt,
            userName: c.user.name,
            userRole: c.user.role,
            saleId: c.sale.id,
            saleForlio: c.sale.folio,
            saleTotal: Number(c.sale.total),
        }));

        const atratoTotal = atratiPendientes.reduce((s, t) => s + t.amount, 0);
        const commissionsTotal = pendingCommissions.reduce((s, c) => s + c.amount, 0);

        // === 5-G: New period-aware queries ===
        // Sales by model (top 5)
        const salesByModelPrisma = await prisma.saleItem.groupBy({
            by: ["productVariantId"],
            where: {
                sale: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    status: "COMPLETED",
                    createdAt: { gte: periodInfo.from, lte: periodInfo.to },
                },
                productVariantId: { not: null },
                isFreeForm: false,
            },
            _sum: { price: true },
            _count: { id: true },
            orderBy: { _sum: { price: "desc" } },
            take: 5,
        });

        const modelVariantIds = salesByModelPrisma
            .map((r) => r.productVariantId)
            .filter((id): id is string => id !== null);

        const modelVariants = modelVariantIds.length > 0
            ? await prisma.productVariant.findMany({
                  where: { id: { in: modelVariantIds } },
                  select: { id: true, modelo: { select: { id: true, nombre: true } } },
              })
            : [];

        const modelNameMap = new Map(modelVariants.map((v) => [v.id, v.modelo.nombre]));

        // Aggregate by model name (multiple variants may share the same modelo)
        const modelRevenueMap = new Map<string, { revenue: number; count: number }>();
        for (const row of salesByModelPrisma) {
            const modelName = modelNameMap.get(row.productVariantId!) ?? "Otro";
            const existing = modelRevenueMap.get(modelName) ?? { revenue: 0, count: 0 };
            existing.revenue += Number(row._sum.price ?? 0);
            existing.count += row._count.id;
            modelRevenueMap.set(modelName, existing);
        }
        const salesByModel = [...modelRevenueMap.entries()]
            .map(([name, data]) => ({ name, revenue: data.revenue, count: data.count }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Sales by seller
        const salesBySellerPrisma = await prisma.sale.groupBy({
            by: ["userId"],
            where: {
                ...(viewBranchId ? { branchId: viewBranchId } : {}),
                status: "COMPLETED",
                createdAt: { gte: periodInfo.from, lte: periodInfo.to },
            },
            _sum: { total: true },
            _count: { id: true },
            orderBy: { _sum: { total: "desc" } },
        });

        const sellerIds = salesBySellerPrisma.map((r) => r.userId);
        const sellerUsers = sellerIds.length > 0
            ? await prisma.user.findMany({
                  where: { id: { in: sellerIds } },
                  select: { id: true, name: true },
              })
            : [];
        const sellerNameMap = new Map(sellerUsers.map((u) => [u.id, u.name]));

        const salesBySeller = salesBySellerPrisma.map((r) => ({
            name: sellerNameMap.get(r.userId) ?? "—",
            revenue: Number(r._sum.total ?? 0),
            count: r._count.id,
        }));

        // Cash flow: COLLECTED vs PENDING for period
        const cashFlowPrisma = await prisma.cashTransaction.groupBy({
            by: ["collectionStatus"],
            where: {
                session: { branchId: viewBranchId ?? undefined },
                type: "PAYMENT_IN",
                createdAt: { gte: periodInfo.from, lte: periodInfo.to },
            },
            _sum: { amount: true },
        });

        const cashFlowCollected = Number(
            cashFlowPrisma.find((r) => r.collectionStatus === "COLLECTED")?._sum.amount ?? 0
        );
        const cashFlowPending = Number(
            cashFlowPrisma.find((r) => r.collectionStatus === "PENDING")?._sum.amount ?? 0
        );

        // Commissions team summary for period
        const commissionsTeamPrisma = await prisma.commissionRecord.groupBy({
            by: ["status"],
            where: {
                createdAt: { gte: periodInfo.from, lte: periodInfo.to },
                ...(viewBranchId ? { user: { branchId: viewBranchId } } : {}),
                status: { in: ["PENDING", "APPROVED"] },
            },
            _sum: { amount: true },
        });

        const commissionsTeamPending = Number(
            commissionsTeamPrisma.find((r) => r.status === "PENDING")?._sum.amount ?? 0
        );
        const commissionsTeamApproved = Number(
            commissionsTeamPrisma.find((r) => r.status === "APPROVED")?._sum.amount ?? 0
        );

        // Attention alerts (parallel)
        const [
            polizasDetenidasPrisma,
            backordersVencidosPrisma,
            cotizacionesPorVencerPrisma,
            stockCriticoPrisma,
            reensamblesPendientesPrisma,
            managerComparisonAgg,
        ] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    status: "COMPLETED",
                    warrantyDocReady: false,
                },
                take: 5,
                orderBy: { createdAt: "desc" },
                select: { id: true, folio: true, customer: { select: { name: true } } },
            }),
            prisma.sale.findMany({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    orderType: "BACKORDER",
                    status: "LAYAWAY",
                    createdAt: { lt: sevenDaysAgo },
                },
                take: 5,
                orderBy: { createdAt: "asc" },
                select: { id: true, folio: true, createdAt: true, customer: { select: { name: true } } },
            }),
            prisma.quotation.findMany({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    status: { in: ["DRAFT", "EN_ESPERA_CLIENTE"] },
                    validUntil: { gte: now, lte: in48Hours },
                },
                take: 5,
                orderBy: { validUntil: "asc" },
                select: {
                    id: true,
                    folio: true,
                    validUntil: true,
                    customer: { select: { name: true } },
                    anonymousCustomerName: true,
                },
            }),
            prisma.stock.findMany({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    quantity: { lte: 2 },
                },
                take: 8,
                orderBy: { quantity: "asc" },
                select: {
                    productVariantId: true,
                    quantity: true,
                    productVariant: {
                        select: {
                            sku: true,
                            modelo: { select: { nombre: true } },
                            color: { select: { nombre: true } },
                            voltaje: { select: { label: true } },
                        },
                    },
                },
            }),
            prisma.assemblyOrder.findMany({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    status: "PENDING",
                },
                take: 5,
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    sale: { select: { folio: true } },
                    productVariant: {
                        select: {
                            modelo: { select: { nombre: true } },
                            voltaje: { select: { label: true } },
                        },
                    },
                },
            }),
            prisma.sale.aggregate({
                where: {
                    ...(viewBranchId ? { branchId: viewBranchId } : {}),
                    status: "COMPLETED",
                    createdAt: { gte: periodInfo.compFrom, lte: periodInfo.compTo },
                },
                _sum: { total: true },
                _count: { id: true },
            }),
        ]);

        const managerAttentionAlerts = {
            polizasDetenidas: polizasDetenidasPrisma.map((s) => ({
                id: s.id,
                folio: s.folio,
                customerName: s.customer?.name ?? null,
            })),
            backordersVencidos: backordersVencidosPrisma.map((s) => ({
                id: s.id,
                folio: s.folio,
                diasPendiente: Math.floor((now.getTime() - s.createdAt.getTime()) / 86400000),
                customerName: s.customer?.name ?? null,
            })),
            cotizacionesPorVencer: cotizacionesPorVencerPrisma.map((q) => ({
                id: q.id,
                folio: q.folio,
                horasRestantes: Math.max(1, Math.ceil((q.validUntil.getTime() - now.getTime()) / 3600000)),
                customerName: q.customer?.name ?? q.anonymousCustomerName ?? null,
            })),
            stockCritico: stockCriticoPrisma
                .filter((s) => s.productVariantId !== null && s.productVariant !== null)
                .map((s) => ({
                    productVariantId: s.productVariantId!,
                    productName: `${s.productVariant!.modelo.nombre} ${s.productVariant!.color.nombre} ${s.productVariant!.voltaje.label}`,
                    sku: s.productVariant!.sku,
                    quantity: s.quantity,
                })),
            reensamblesPendientes: reensamblesPendientesPrisma.map((a) => ({
                id: a.id,
                productName: a.productVariant
                    ? `${a.productVariant.modelo.nombre} ${a.productVariant.voltaje.label}`
                    : null,
                folio: a.sale?.folio ?? null,
            })),
        };

        return (
            <ManagerDashboard
                role={role}
                branchName={branchName}
                period={periodInfo.period}
                periodLabel={periodInfo.periodLabel}
                compLabel={periodInfo.compLabel}
                revenueToday={revenueToday}
                transactionsToday={transactionsToday}
                revenueYesterday={Number(managerComparisonAgg._sum.total ?? 0)}
                transactionsYesterday={managerComparisonAgg._count.id}
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
                attentionAlerts={managerAttentionAlerts}
                salesByModel={salesByModel}
                salesBySeller={salesBySeller}
                cashFlow={{ collected: cashFlowCollected, pending: cashFlowPending }}
                commissionsTeam={{ pending: commissionsTeamPending, approved: commissionsTeamApproved }}
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

        const branchCashSession = branchId
            ? await prisma.cashRegisterSession.findFirst({
                  where: { branchId, status: "OPEN" },
                  select: { id: true, openingAmt: true },
              })
            : null;

        const openSessionId = branchCashSession?.id ?? null;

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
                      sale: { select: { id: true, folio: true } },
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
            saleId: t.sale?.id ?? null,
            saleForlio: t.sale?.folio ?? null,
            diasPendiente: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
        }));

        // Attention alerts for seller (parallel)
        const [
            sellerBackordersPrisma,
            sellerCotizacionesPrisma,
            sellerYesterdayAgg,
            sellerPaymentsByMethod,
            sellerCashOutAgg,
            sellerCommissionsPrisma,
        ] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    userId,
                    orderType: "BACKORDER",
                    status: "LAYAWAY",
                    createdAt: { lt: sevenDaysAgo },
                },
                take: 5,
                orderBy: { createdAt: "asc" },
                select: { id: true, folio: true, createdAt: true, customer: { select: { name: true } } },
            }),
            prisma.quotation.findMany({
                where: {
                    userId,
                    status: { in: ["DRAFT", "EN_ESPERA_CLIENTE"] },
                    validUntil: { gte: now, lte: in48Hours },
                },
                take: 5,
                orderBy: { validUntil: "asc" },
                select: {
                    id: true,
                    folio: true,
                    validUntil: true,
                    customer: { select: { name: true } },
                    anonymousCustomerName: true,
                },
            }),
            prisma.sale.aggregate({
                where: {
                    userId,
                    status: "COMPLETED",
                    createdAt: { gte: startOfYesterday, lte: endOfYesterday },
                },
                _sum: { total: true },
                _count: { id: true },
            }),
            openSessionId
                ? prisma.cashTransaction.groupBy({
                      by: ["method"],
                      where: { sessionId: openSessionId, type: "PAYMENT_IN" },
                      _sum: { amount: true },
                  })
                : Promise.resolve([]),
            openSessionId
                ? prisma.cashTransaction.aggregate({
                      where: {
                          sessionId: openSessionId,
                          type: { in: ["REFUND_OUT", "EXPENSE_OUT", "WITHDRAWAL"] },
                          method: "CASH",
                      },
                      _sum: { amount: true },
                  })
                : Promise.resolve({ _sum: { amount: null } }),
            prisma.commissionRecord.findMany({
                where: { userId, createdAt: { gte: startOfMonth } },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    amount: true,
                    status: true,
                    createdAt: true,
                    sale: { select: { id: true, folio: true } },
                },
            }),
        ]);

        const sellerPaymentsMap = new Map(
            sellerPaymentsByMethod.map((m) => [m.method as string, Number(m._sum.amount ?? 0)])
        );
        const sellerCashIn = sellerPaymentsMap.get("CASH") ?? 0;
        const sellerCashOut = Number(sellerCashOutAgg._sum.amount ?? 0);
        const openingAmt = branchCashSession ? Number(branchCashSession.openingAmt) : 0;
        const cashInDrawer = openingAmt + sellerCashIn - sellerCashOut;
        const totalCobrado = [...sellerPaymentsMap.values()].reduce((a, b) => a + b, 0);
        const paymentBreakdown = (["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"] as const)
            .map((method) => ({ method, amount: sellerPaymentsMap.get(method) ?? 0 }))
            .filter((m) => m.amount > 0);

        const commissions = sellerCommissionsPrisma.map((c) => ({
            id: c.id,
            amount: Number(c.amount),
            status: c.status as "PENDING" | "APPROVED" | "PAID",
            createdAt: c.createdAt,
            saleId: c.sale.id,
            saleForlio: c.sale.folio,
        }));
        const commissionsTotal = commissions.reduce((s, c) => s + c.amount, 0);
        const commissionsByStatus = {
            PENDING: commissions.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.amount, 0),
            APPROVED: commissions.filter((c) => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0),
            PAID: commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + c.amount, 0),
        };

        const sellerAttentionAlerts = {
            polizasDetenidas: [],
            stockCritico: [],
            reensamblesPendientes: [],
            backordersVencidos: sellerBackordersPrisma.map((s) => ({
                id: s.id,
                folio: s.folio,
                diasPendiente: Math.floor((now.getTime() - s.createdAt.getTime()) / 86400000),
                customerName: s.customer?.name ?? null,
            })),
            cotizacionesPorVencer: sellerCotizacionesPrisma.map((q) => ({
                id: q.id,
                folio: q.folio,
                horasRestantes: Math.max(1, Math.ceil((q.validUntil.getTime() - now.getTime()) / 3600000)),
                customerName: q.customer?.name ?? q.anonymousCustomerName ?? null,
            })),
        };

        return (
            <SellerDashboard
                branchName={branchName}
                salesTodayCount={sellerSalesAgg._count.id}
                revenueToday={Number(sellerSalesAgg._sum.total ?? 0)}
                salesYesterdayCount={sellerYesterdayAgg._count.id}
                revenueYesterday={Number(sellerYesterdayAgg._sum.total ?? 0)}
                activeLayawaysCount={activeLayawaysCountSeller}
                cashSession={{
                    isOpen: branchCashSession !== null,
                    openingAmt,
                    cashInDrawer,
                    totalCobrado,
                    byMethod: paymentBreakdown,
                }}
                recentSales={recentSales}
                layaways={layaways}
                atratoRows={atratoRows}
                commissions={commissions}
                commissionsTotal={commissionsTotal}
                commissionsByStatus={commissionsByStatus}
                attentionAlerts={sellerAttentionAlerts}
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

        // Attention alerts for technician (parallel)
        const [techPolizasPrisma, techStockPrisma, techReensamblesPrisma, techYesterdayDelivered, techAssemblyCount] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    ...(branchId ? { branchId } : {}),
                    status: "COMPLETED",
                    warrantyDocReady: false,
                },
                take: 5,
                orderBy: { createdAt: "desc" },
                select: { id: true, folio: true, customer: { select: { name: true } } },
            }),
            prisma.stock.findMany({
                where: {
                    ...(branchId ? { branchId } : {}),
                    quantity: { lte: 2 },
                },
                take: 8,
                orderBy: { quantity: "asc" },
                select: {
                    productVariantId: true,
                    quantity: true,
                    productVariant: {
                        select: {
                            sku: true,
                            modelo: { select: { nombre: true } },
                            color: { select: { nombre: true } },
                            voltaje: { select: { label: true } },
                        },
                    },
                },
            }),
            prisma.assemblyOrder.findMany({
                where: {
                    ...(branchId ? { branchId } : {}),
                    status: "PENDING",
                },
                take: 5,
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    createdAt: true,
                    sale: { select: { id: true, folio: true } },
                    productVariant: {
                        select: {
                            imageUrl: true,
                            sku: true,
                            modelo: { select: { nombre: true } },
                            color: { select: { nombre: true } },
                            voltaje: { select: { label: true } },
                        },
                    },
                },
            }),
            prisma.serviceOrder.count({
                where: {
                    ...(branchId ? { branchId } : {}),
                    status: "DELIVERED",
                    updatedAt: { gte: startOfYesterday, lte: endOfYesterday },
                },
            }),
            prisma.assemblyOrder.count({
                where: {
                    ...(branchId ? { branchId } : {}),
                    status: "PENDING",
                },
            }),
        ]);

        const assemblyPending = techReensamblesPrisma.map((a) => ({
            id: a.id,
            productName: a.productVariant
                ? `${a.productVariant.modelo.nombre} ${a.productVariant.voltaje.label}`
                : null,
            imageUrl: a.productVariant?.imageUrl ?? null,
            sku: a.productVariant?.sku ?? null,
            color: a.productVariant?.color.nombre ?? null,
            saleId: a.sale?.id ?? null,
            folio: a.sale?.folio ?? null,
            minutesPending: Math.floor((now.getTime() - a.createdAt.getTime()) / 60000),
        }));

        const techAttentionAlerts = {
            backordersVencidos: [],
            cotizacionesPorVencer: [],
            polizasDetenidas: techPolizasPrisma.map((s) => ({
                id: s.id,
                folio: s.folio,
                customerName: s.customer?.name ?? null,
            })),
            stockCritico: techStockPrisma
                .filter((s) => s.productVariantId !== null && s.productVariant !== null)
                .map((s) => ({
                    productVariantId: s.productVariantId!,
                    productName: `${s.productVariant!.modelo.nombre} ${s.productVariant!.color.nombre} ${s.productVariant!.voltaje.label}`,
                    sku: s.productVariant!.sku,
                    quantity: s.quantity,
                })),
            reensamblesPendientes: techReensamblesPrisma.map((a) => ({
                id: a.id,
                productName: a.productVariant
                    ? `${a.productVariant.modelo.nombre} ${a.productVariant.voltaje.label}`
                    : null,
                folio: a.sale?.folio ?? null,
            })),
        };

        return (
            <TechnicianDashboard
                branchName={branchName}
                activeOrdersCount={activeOrdersCountTech}
                readyOrdersCount={readyOrdersCountTech}
                deliveredTodayCount={deliveredTodayCountTech}
                deliveredYesterdayCount={techYesterdayDelivered}
                assemblyPendingCount={techAssemblyCount}
                assemblyPending={assemblyPending}
                activeOrders={activeOrders}
                readyOrders={readyOrders}
                maintenanceAlerts={maintenanceAlerts}
                attentionAlerts={techAttentionAlerts}
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
