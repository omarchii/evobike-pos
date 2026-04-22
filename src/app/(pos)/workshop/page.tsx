import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkshopBoard from "./workshop-board";
import WorkshopKpis, { type WorkshopKpiData } from "./workshop-kpis";
import {
  WorkshopAttention,
  type WorkshopAttentionData,
  type ReensambleAlert,
  type PrepaidStockAlert,
  type StaleOrderAlert,
} from "./workshop-attention";
import { NewOrderDialog } from "./new-order-dialog";
import { parseLocalDate, toDateString } from "@/lib/reportes/date-range";
import type {
  SerializedBoardOrder,
  SerializedDeliveredOrder,
  SerializedCancelledOrder,
} from "./workshop-types";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

// ── Board query includes (declared as const for GetPayload inference) ──────────

const activeInclude = {
  assignedTech: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  customerBike: {
    include: {
      productVariant: {
        include: { modelo: true, voltaje: true, capacidad: true },
      },
    },
  },
} satisfies Prisma.ServiceOrderInclude;

const deliveredInclude = {
  customer: { select: { name: true } },
  assignedTech: { select: { name: true } },
} satisfies Prisma.ServiceOrderInclude;

const cancelledInclude = {
  customer: { select: { name: true } },
} satisfies Prisma.ServiceOrderInclude;

type ActiveOrder = Prisma.ServiceOrderGetPayload<{
  include: typeof activeInclude;
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBikeDisplay(order: ActiveOrder): string | null {
  const bike = order.customerBike;
  if (bike?.productVariant) {
    const v = bike.productVariant;
    const parts: string[] = [];
    if (v.modelo?.nombre) parts.push(v.modelo.nombre);
    if (v.voltaje?.valor) parts.push(`${v.voltaje.valor}V`);
    if (v.capacidad?.valorAh) parts.push(`${v.capacidad.valorAh}Ah`);
    if (parts.length > 0) return parts.join(" · ");
  }
  if (bike) {
    const fallback = [bike.brand, bike.model].filter(Boolean).join(" ");
    if (fallback) return fallback;
  }
  return order.bikeInfo ?? null;
}

export default async function WorkshopPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { id: userId, role, branchId } = session.user as unknown as SessionUser;

  const branchFilter = role === "ADMIN" ? {} : { branchId };

  const todayStart = parseLocalDate(toDateString(new Date()), false) ?? new Date();
  // eslint-disable-next-line react-hooks/purity -- corre por request, no en render
  const nowMs = Date.now();
  const threeDaysAgo = new Date(nowMs - 3 * 24 * 60 * 60 * 1000);

  const [
    active,
    deliveredToday,
    cancelledToday,
    technicians,
    prepaidPendingCount,
    readyPendingChargeCount,
    revenueTodayAgg,
    recentDeliveries,
    pendingReensambles,
    prepaidOrdersWithItems,
    staleInProgress,
  ] = await Promise.all([
    // ── Board: active orders (PENDING + IN_PROGRESS + COMPLETED) ──
    prisma.serviceOrder.findMany({
      where: {
        ...branchFilter,
        status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
      },
      include: activeInclude,
      orderBy: { updatedAt: "desc" },
    }),

    // ── Board: delivered today ──
    prisma.serviceOrder.findMany({
      where: {
        ...branchFilter,
        status: "DELIVERED",
        updatedAt: { gte: todayStart },
      },
      include: deliveredInclude,
      orderBy: { updatedAt: "desc" },
    }),

    // ── Board: cancelled today ──
    prisma.serviceOrder.findMany({
      where: {
        ...branchFilter,
        status: "CANCELLED",
        updatedAt: { gte: todayStart },
      },
      include: cancelledInclude,
      orderBy: { updatedAt: "desc" },
    }),

    // ── Board: active technicians ──
    prisma.user.findMany({
      where: { ...branchFilter, role: "TECHNICIAN", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // ── KPI: prepaid pending delivery ──
    prisma.serviceOrder.count({
      where: { ...branchFilter, prepaid: true, status: { in: ["COMPLETED"] } },
    }),

    // ── KPI: completed not charged ──
    prisma.serviceOrder.count({
      where: { ...branchFilter, prepaid: false, status: "COMPLETED" },
    }),

    // ── KPI: revenue today from service sales ──
    prisma.sale.aggregate({
      where: {
        ...branchFilter,
        serviceOrderId: { not: null },
        status: "COMPLETED",
        createdAt: { gte: todayStart },
      },
      _sum: { total: true },
    }),

    // ── KPI: last 30 deliveries for avg repair time ──
    prisma.serviceOrder.findMany({
      where: { ...branchFilter, status: "DELIVERED" },
      select: { createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),

    // ── Attention: reensambles PENDING vinculados a ventas ──
    prisma.assemblyOrder.findMany({
      where: { ...branchFilter, status: "PENDING", saleId: { not: null } },
      select: {
        id: true,
        saleId: true,
        sale: {
          select: { folio: true, customer: { select: { name: true } } },
        },
        productVariant: {
          select: { sku: true, modelo: { select: { nombre: true } } },
        },
      },
    }),

    // ── Attention: prepaid orders with inventory items ──
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

    // ── Attention: stale IN_PROGRESS orders (> 3 days) ──
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

  // ── KPI computation ───────────────────────────────────────────────────────

  let avgRepairHours: number | null = null;
  if (recentDeliveries.length > 0) {
    const totalMs = recentDeliveries.reduce(
      (sum, d) => sum + (d.updatedAt.getTime() - d.createdAt.getTime()),
      0
    );
    avgRepairHours = Math.round((totalMs / recentDeliveries.length / 3_600_000) * 10) / 10;
  }

  const kpiData: WorkshopKpiData = {
    activeOrders: active.length,
    prepaidPendingDelivery: prepaidPendingCount,
    readyPendingCharge: readyPendingChargeCount,
    revenueToday: Number(revenueTodayAgg._sum.total ?? 0),
    avgRepairHours,
  };

  // ── Attention computation ─────────────────────────────────────────────────

  const reensambleAlerts: ReensambleAlert[] = pendingReensambles.map((r) => ({
    assemblyId: r.id,
    saleId: r.saleId!,
    saleFolio: r.sale?.folio ?? null,
    productName:
      r.productVariant?.modelo?.nombre ?? r.productVariant?.sku ?? null,
    customerName: r.sale?.customer?.name ?? null,
  }));

  const allVariantIds = [
    ...new Set(
      prepaidOrdersWithItems
        .flatMap((o) => o.items.map((i) => i.productVariantId))
        .filter((id): id is string => id !== null)
    ),
  ];
  const stockMap = new Map<string, number>();
  if (allVariantIds.length > 0) {
    const stocks = await prisma.stock.findMany({
      where: {
        productVariantId: { in: allVariantIds },
        ...(role !== "ADMIN" ? { branchId } : {}),
      },
      select: { productVariantId: true, quantity: true },
    });
    for (const s of stocks) {
      if (!s.productVariantId) continue;
      stockMap.set(
        s.productVariantId,
        (stockMap.get(s.productVariantId) ?? 0) + s.quantity
      );
    }
  }

  const prepaidStockAlerts: PrepaidStockAlert[] = [];
  for (const order of prepaidOrdersWithItems) {
    const missing: string[] = [];
    for (const item of order.items) {
      if (!item.productVariantId) continue;
      if ((stockMap.get(item.productVariantId) ?? 0) < item.quantity) {
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

  const staleAlerts: StaleOrderAlert[] = staleInProgress.map((s) => ({
    orderId: s.id,
    folio: s.folio,
    customerName: s.customer.name,
    bikeInfo: s.bikeInfo,
    days: Math.floor((nowMs - s.updatedAt.getTime()) / 86_400_000),
    technicianName: s.user.name,
  }));

  const attentionData: WorkshopAttentionData = {
    reensambles: reensambleAlerts,
    prepaidNoStock: prepaidStockAlerts,
    staleOrders: staleAlerts,
  };

  // ── Serialize board data (Decimal → number, Date → ms timestamp) ──────────

  const serializedActive: SerializedBoardOrder[] = active.map((o) => ({
    id: o.id,
    folio: o.folio,
    status: o.status as SerializedBoardOrder["status"],
    subStatus: (o.subStatus ?? null) as SerializedBoardOrder["subStatus"],
    type: o.type as SerializedBoardOrder["type"],
    createdAtMs: o.createdAt.getTime(),
    updatedAtMs: o.updatedAt.getTime(),
    customer: o.customer,
    assignedTech: o.assignedTech ?? null,
    bikeDisplay: computeBikeDisplay(o),
  }));

  const serializedDelivered: SerializedDeliveredOrder[] = deliveredToday.map(
    (o) => ({
      id: o.id,
      folio: o.folio,
      updatedAtMs: o.updatedAt.getTime(),
      customerName: o.customer.name,
      techName: o.assignedTech?.name ?? null,
    })
  );

  const serializedCancelled: SerializedCancelledOrder[] = cancelledToday.map(
    (o) => ({
      id: o.id,
      folio: o.folio,
      updatedAtMs: o.updatedAt.getTime(),
      customerName: o.customer.name,
    })
  );

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

      <WorkshopBoard
        active={serializedActive}
        deliveredToday={serializedDelivered}
        cancelledToday={serializedCancelled}
        technicians={technicians}
        currentUser={{ id: userId, role }}
        nowMs={nowMs}
      />
    </div>
  );
}
