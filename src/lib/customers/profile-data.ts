// Datos server-side del perfil de cliente (BRIEF §7.4 — Sub-fase E).
// Carga base + KPIs (LTV, última visita, sucursal preferida) + alertas
// activas + chips dinámicos en una sola pasada.

import { prisma } from "@/lib/prisma";
import { computeMaintenanceStatus, type MaintenanceLevel } from "@/lib/workshop-maintenance";
import { computeSegmentChips, type SegmentChip } from "./segmentation";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

const DAY = 24 * 60 * 60 * 1000;

export interface ProfileBase {
  id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  rfc: string | null;
  razonSocial: string | null;
  isBusiness: boolean;
  tags: string[];
  shippingCity: string | null;
  shippingState: string | null;
  balance: number;
  creditLimit: number;
  birthday: Date | null;
  communicationConsent: boolean;
  deletedAt: Date | null;
  mergedIntoId: string | null;
}

export interface ProfileKpis {
  ltvTotal: number;
  ltvPrevYear: number;
  ltvDeltaPct: number | null;
  lastActivityAt: Date | null;
  preferredBranch: { id: string; name: string; pct: number } | null;
}

export interface AlertItem {
  kind:
    | "MAINTENANCE_OVERDUE"
    | "AR_OVERDUE"
    | "QUOTATION_EXPIRING"
    | "BALANCE_TO_USE";
  title: string;
  detail: string;
  href: string;
  cta: string;
}

export interface SidebarSummary {
  balance: number;
  creditLimit: number;
  arPending: number;
  pinnedNotes: Array<{
    id: string;
    body: string;
    kind: string;
    authorName: string | null;
    createdAt: Date;
  }>;
}

export interface CustomerProfileData {
  base: ProfileBase;
  kpis: ProfileKpis;
  alerts: AlertItem[];
  segments: SegmentChip[];
  sidebar: SidebarSummary;
  /** Conteos básicos para los tabs todavía no rediseñados (F/G/H/I). */
  counts: {
    sales: number;
    serviceOrders: number;
    bikes: number;
    quotations: number;
  };
  /** Si el cliente fue mergeado, ID del target (para redirect 308). */
  mergedTargetId: string | null;
}

export async function getCustomerProfileData(
  customerId: string,
): Promise<CustomerProfileData | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      phone2: true,
      email: true,
      rfc: true,
      razonSocial: true,
      isBusiness: true,
      tags: true,
      shippingCity: true,
      shippingState: true,
      creditLimit: true,
      birthday: true,
      communicationConsent: true,
      deletedAt: true,
      mergedIntoId: true,
      _count: {
        select: {
          sales: true,
          serviceOrders: true,
          bikes: true,
          quotations: true,
        },
      },
    },
  });

  if (!customer) return null;

  // Saldo a favor desde CustomerCredit (Pack D.5 — sweep de Customer.balance).
  const { total: creditBalance } = await getCustomerCreditBalance(customerId);

  const base: ProfileBase = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    phone2: customer.phone2,
    email: customer.email,
    rfc: customer.rfc,
    razonSocial: customer.razonSocial,
    isBusiness: customer.isBusiness,
    tags: customer.tags,
    shippingCity: customer.shippingCity,
    shippingState: customer.shippingState,
    balance: creditBalance,
    creditLimit: Number(customer.creditLimit),
    birthday: customer.birthday,
    communicationConsent: customer.communicationConsent,
    deletedAt: customer.deletedAt,
    mergedIntoId: customer.mergedIntoId,
  };

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * DAY);
  const twoYearsAgo = new Date(now.getTime() - 730 * DAY);

  const [
    completedAgg,
    ltvCurrYearAgg,
    ltvPrevYearAgg,
    layawayAgg,
    lastSale,
    lastSo,
    lastQuo,
    salesByBranch,
    sosByBranch,
    quosByBranch,
    branchNames,
    pinnedNotes,
    layawaysOverdue,
    bikes,
    quotationsExpiring,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { customerId, status: "COMPLETED" },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: {
        customerId,
        status: "COMPLETED",
        createdAt: { gte: oneYearAgo },
      },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: {
        customerId,
        status: "COMPLETED",
        createdAt: { gte: twoYearsAgo, lt: oneYearAgo },
      },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { customerId, status: "LAYAWAY" },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { customerId },
      _max: { createdAt: true },
    }),
    prisma.serviceOrder.aggregate({
      where: { customerId },
      _max: { createdAt: true },
    }),
    prisma.quotation.aggregate({
      where: { customerId },
      _max: { createdAt: true },
    }),
    prisma.sale.groupBy({
      by: ["branchId"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ["branchId"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.quotation.groupBy({
      by: ["branchId"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
    prisma.customerNote.findMany({
      where: { customerId, pinned: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { name: true } } },
    }),
    prisma.sale.findMany({
      where: { customerId, status: "LAYAWAY" },
      select: {
        id: true,
        folio: true,
        total: true,
        expectedDeliveryDate: true,
        createdAt: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.customerBike.findMany({
      where: { customerId },
      select: {
        id: true,
        serialNumber: true,
        brand: true,
        model: true,
        assemblyOrders: {
          where: {
            saleId: { not: null },
            sale: { status: { not: "CANCELLED" } },
          },
          select: { sale: { select: { createdAt: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        serviceOrders: {
          where: {
            status: "DELIVERED",
            items: { some: { serviceCatalog: { esMantenimiento: true } } },
          },
          select: {
            updatedAt: true,
            sale: { select: { createdAt: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.quotation.findMany({
      where: {
        customerId,
        validUntil: { gte: now, lte: new Date(now.getTime() + 7 * DAY) },
        status: { in: ["DRAFT", "EN_ESPERA_CLIENTE", "EN_ESPERA_FABRICA"] },
      },
      select: { id: true, folio: true, validUntil: true, total: true },
      orderBy: { validUntil: "asc" },
      take: 3,
    }),
  ]);

  const ltvTotal = Number(completedAgg._sum.total ?? 0);
  const ltvCurrYear = Number(ltvCurrYearAgg._sum.total ?? 0);
  const ltvPrevYear = Number(ltvPrevYearAgg._sum.total ?? 0);
  const ltvDeltaPct =
    ltvPrevYear > 0 ? (ltvCurrYear - ltvPrevYear) / ltvPrevYear : null;

  const arPending = Number(layawayAgg._sum.total ?? 0);

  const lastActivityCandidates = [
    lastSale._max.createdAt,
    lastSo._max.createdAt,
    lastQuo._max.createdAt,
  ].filter((d): d is Date => d instanceof Date);
  const lastActivityAt =
    lastActivityCandidates.length > 0
      ? lastActivityCandidates.reduce((a, b) => (a > b ? a : b))
      : null;

  // Sucursal preferida = la que tiene más actividad (sale + so + quo).
  const branchVisits = new Map<string, number>();
  for (const r of salesByBranch) {
    branchVisits.set(r.branchId, (branchVisits.get(r.branchId) ?? 0) + r._count._all);
  }
  for (const r of sosByBranch) {
    branchVisits.set(r.branchId, (branchVisits.get(r.branchId) ?? 0) + r._count._all);
  }
  for (const r of quosByBranch) {
    branchVisits.set(r.branchId, (branchVisits.get(r.branchId) ?? 0) + r._count._all);
  }

  const totalVisits = Array.from(branchVisits.values()).reduce((s, v) => s + v, 0);
  let preferredBranch: ProfileKpis["preferredBranch"] = null;
  if (totalVisits > 0) {
    let topId = "";
    let topCount = 0;
    for (const [branchId, count] of branchVisits) {
      if (count > topCount) {
        topId = branchId;
        topCount = count;
      }
    }
    const branchName = branchNames.find((b) => b.id === topId)?.name ?? "—";
    preferredBranch = {
      id: topId,
      name: branchName,
      pct: totalVisits > 0 ? topCount / totalVisits : 0,
    };
  }

  // Chips dinámicos: necesitan salesCountLast12mo.
  const salesCountLast12mo = await prisma.sale.count({
    where: {
      customerId,
      status: "COMPLETED",
      createdAt: { gte: oneYearAgo },
    },
  });

  const segments = computeSegmentChips(
    {
      isBusiness: customer.isBusiness,
      phone: customer.phone,
      balance: creditBalance,
      communicationConsent: customer.communicationConsent,
      salesCountLast12mo,
      lastActivityAt,
      arPending,
      balanceUpdatedAt: null,
    },
    now,
  );

  // Alertas
  const alerts: AlertItem[] = [];

  // 1) Mantenimiento vencido en alguna bici
  for (const bike of bikes) {
    const purchase = bike.assemblyOrders[0]?.sale?.createdAt ?? null;
    if (!purchase) continue;
    const lastMant =
      bike.serviceOrders[0]?.sale?.createdAt ??
      bike.serviceOrders[0]?.updatedAt ??
      null;
    const status = computeMaintenanceStatus({
      purchaseDate: purchase,
      lastMaintenanceAt: lastMant,
    });
    if (status.nivel === ("VENCIDO" satisfies MaintenanceLevel)) {
      const overdueDays = Math.abs(status.diasRestantes);
      const bikeLabel = `${bike.brand ?? ""} ${bike.model ?? ""}`.trim() || `VIN ${bike.serialNumber}`;
      alerts.push({
        kind: "MAINTENANCE_OVERDUE",
        title: `Mantenimiento vencido — ${bikeLabel}`,
        detail: `${overdueDays} día${overdueDays === 1 ? "" : "s"} vencidos`,
        href: `/workshop/recepcion?customerBikeId=${bike.id}`,
        cta: "Agendar",
      });
    }
  }

  // 2) Saldo por cobrar vencido (LAYAWAYs con expectedDeliveryDate < hoy y outstanding > 0)
  for (const layaway of layawaysOverdue) {
    const total = Number(layaway.total);
    const paid = layaway.payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = total - paid;
    if (outstanding <= 0) continue;
    const expected = layaway.expectedDeliveryDate;
    if (expected && expected < now) {
      const days = Math.floor((now.getTime() - expected.getTime()) / DAY);
      alerts.push({
        kind: "AR_OVERDUE",
        title: `Apartado ${layaway.folio} vencido`,
        detail: `$${outstanding.toLocaleString("es-MX", { maximumFractionDigits: 0 })} vencidos hace ${days} día${days === 1 ? "" : "s"}`,
        href: `/sales/${layaway.id}`,
        cta: "Cobrar",
      });
    }
  }

  // 3) Cotización próxima a expirar (≤7d)
  for (const q of quotationsExpiring) {
    const days = Math.max(
      0,
      Math.floor((q.validUntil!.getTime() - now.getTime()) / DAY),
    );
    alerts.push({
      kind: "QUOTATION_EXPIRING",
      title: `Cotización ${q.folio} por expirar`,
      detail: `Vence en ${days} día${days === 1 ? "" : "s"}`,
      href: `/cotizaciones/${q.id}`,
      cta: "Reactivar",
    });
  }

  return {
    base,
    kpis: {
      ltvTotal,
      ltvPrevYear,
      ltvDeltaPct,
      lastActivityAt,
      preferredBranch,
    },
    alerts,
    segments,
    sidebar: {
      balance: creditBalance,
      creditLimit: Number(customer.creditLimit),
      arPending,
      pinnedNotes: pinnedNotes.map((n) => ({
        id: n.id,
        body: n.body,
        kind: n.kind,
        authorName: n.author?.name ?? null,
        createdAt: n.createdAt,
      })),
    },
    counts: {
      sales: customer._count.sales,
      serviceOrders: customer._count.serviceOrders,
      bikes: customer._count.bikes,
      quotations: customer._count.quotations,
    },
    mergedTargetId: customer.mergedIntoId,
  };
}
