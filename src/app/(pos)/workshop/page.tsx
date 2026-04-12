import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkshopBoard from "./workshop-board";
import WorkshopKpis, { type WorkshopKpiData } from "./workshop-kpis";
import { WorkshopAttention, type WorkshopAttentionData, type ReensambleAlert, type PrepaidStockAlert, type StaleOrderAlert } from "./workshop-attention";
import { NewOrderDialog } from "./new-order-dialog";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

export default async function WorkshopPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");
    const { id: userId, role, branchId } = session.user as unknown as SessionUser;

    const branchFilter = role === "ADMIN" ? {} : { branchId };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [serviceOrders, prepaidPendingCount, readyPendingChargeCount, revenueTodayAgg, recentDeliveries, pendingReensambles, prepaidOrdersWithItems, staleInProgress] = await Promise.all([
        // Active orders for the Kanban board
        prisma.serviceOrder.findMany({
            where: {
                ...branchFilter,
                status: { notIn: ["DELIVERED", "CANCELLED"] },
            },
            include: {
                customer: true,
                items: true,
                user: true,
            },
            orderBy: { createdAt: "desc" },
        }),

        // Prepaid orders pending delivery (cobradas pero no entregadas)
        prisma.serviceOrder.count({
            where: {
                ...branchFilter,
                prepaid: true,
                status: { in: ["COMPLETED"] },
            },
        }),

        // Completed but not charged (listas, cobro pendiente)
        prisma.serviceOrder.count({
            where: {
                ...branchFilter,
                prepaid: false,
                status: "COMPLETED",
            },
        }),

        // Revenue today from service sales (Sale linked to ServiceOrder)
        prisma.sale.aggregate({
            where: {
                ...branchFilter,
                serviceOrderId: { not: null },
                status: "COMPLETED",
                createdAt: { gte: todayStart },
            },
            _sum: { total: true },
        }),

        // Last 30 delivered orders for avg repair time
        prisma.serviceOrder.findMany({
            where: {
                ...branchFilter,
                status: "DELIVERED",
            },
            select: { createdAt: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 30,
        }),

        // --- Attention queries ---

        // Reensambles PENDING vinculados a ventas (pólizas detenidas)
        prisma.assemblyOrder.findMany({
            where: {
                ...branchFilter,
                status: "PENDING",
                saleId: { not: null },
            },
            select: {
                id: true,
                saleId: true,
                sale: { select: { folio: true, customer: { select: { name: true } } } },
                productVariant: { select: { sku: true, modelo: { select: { nombre: true } } } },
            },
        }),

        // Prepaid ServiceOrders (not DELIVERED/CANCELLED) with inventory items — check stock later
        prisma.serviceOrder.findMany({
            where: {
                ...branchFilter,
                prepaid: true,
                status: { notIn: ["DELIVERED", "CANCELLED"] },
            },
            select: {
                id: true,
                folio: true,
                branchId: true,
                customer: { select: { name: true } },
                items: {
                    where: { productVariantId: { not: null } },
                    select: {
                        productVariantId: true,
                        quantity: true,
                        description: true,
                    },
                },
            },
        }),

        // Stale IN_PROGRESS orders (>3 days)
        prisma.serviceOrder.findMany({
            where: {
                ...branchFilter,
                status: "IN_PROGRESS",
                updatedAt: { lt: threeDaysAgo },
            },
            select: {
                id: true,
                folio: true,
                bikeInfo: true,
                updatedAt: true,
                customer: { select: { name: true } },
                user: { select: { name: true } },
            },
        }),
    ]);

    // Compute avg repair hours from last 30 deliveries
    let avgRepairHours: number | null = null;
    if (recentDeliveries.length > 0) {
        const totalMs = recentDeliveries.reduce((sum, d) => {
            return sum + (d.updatedAt.getTime() - d.createdAt.getTime());
        }, 0);
        const avgMs = totalMs / recentDeliveries.length;
        avgRepairHours = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10; // 1 decimal
    }

    const kpiData: WorkshopKpiData = {
        activeOrders: serviceOrders.length,
        prepaidPendingDelivery: prepaidPendingCount,
        readyPendingCharge: readyPendingChargeCount,
        revenueToday: Number(revenueTodayAgg._sum.total ?? 0),
        avgRepairHours,
    };

    // --- Compute attention data ---

    // Reensambles → direct map
    const reensambleAlerts: ReensambleAlert[] = pendingReensambles.map((r) => ({
        assemblyId: r.id,
        saleId: r.saleId!,
        saleFolio: r.sale?.folio ?? null,
        productName: r.productVariant?.modelo?.nombre ?? r.productVariant?.sku ?? null,
        customerName: r.sale?.customer?.name ?? null,
    }));

    // Prepaid without stock — batch-check stock for all referenced productVariantIds
    const allVariantIds = [...new Set(
        prepaidOrdersWithItems.flatMap(o => o.items.map(i => i.productVariantId).filter((id): id is string => id !== null))
    )];
    const stockMap = new Map<string, number>();
    if (allVariantIds.length > 0) {
        const stocks = await prisma.stock.findMany({
            where: {
                productVariantId: { in: allVariantIds },
                // Check stock in the order's branch (all share branchFilter)
                ...(role !== "ADMIN" ? { branchId } : {}),
            },
            select: { productVariantId: true, quantity: true },
        });
        for (const s of stocks) {
            stockMap.set(s.productVariantId, (stockMap.get(s.productVariantId) ?? 0) + s.quantity);
        }
    }

    const prepaidStockAlerts: PrepaidStockAlert[] = [];
    for (const order of prepaidOrdersWithItems) {
        const missing: string[] = [];
        for (const item of order.items) {
            if (!item.productVariantId) continue;
            const available = stockMap.get(item.productVariantId) ?? 0;
            if (available < item.quantity) {
                missing.push(item.description);
            }
        }
        if (missing.length > 0) {
            prepaidStockAlerts.push({
                orderId: order.id,
                folio: order.folio,
                customerName: order.customer.name,
                missingItems: missing,
            });
        }
    }

    // Stale orders → direct map
    const staleAlerts: StaleOrderAlert[] = staleInProgress.map((s) => ({
        orderId: s.id,
        folio: s.folio,
        customerName: s.customer.name,
        bikeInfo: s.bikeInfo,
        days: Math.floor((Date.now() - new Date(s.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
        technicianName: s.user.name,
    }));

    const attentionData: WorkshopAttentionData = {
        reensambles: reensambleAlerts,
        prepaidNoStock: prepaidStockAlerts,
        staleOrders: staleAlerts,
    };

    const serializedOrders = serviceOrders.map(so => ({
        ...so,
        subtotal: Number(so.subtotal),
        total: Number(so.total),
        customer: {
            ...so.customer,
            creditLimit: Number(so.customer.creditLimit),
            balance: Number(so.customer.balance)
        },
        items: so.items.map(i => ({
            ...i,
            price: Number(i.price)
        }))
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1
                        className="text-[1.5rem] font-bold text-[var(--on-surf)] tracking-[-0.01em]"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Taller Mecánico
                    </h1>
                    <p className="text-sm text-[var(--on-surf-var)]">
                        Gestiona las bicicletas y reparaciones activas.
                    </p>
                </div>
                <NewOrderDialog />
            </div>

            <WorkshopKpis data={kpiData} />

            <WorkshopAttention data={attentionData} />

            {/* Client Component Kanban Board */}
            <WorkshopBoard initialOrders={serializedOrders} currentUserId={userId} currentUserRole={role} />
        </div>
    );
}
