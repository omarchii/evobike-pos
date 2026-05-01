// Query enriquecido del directorio de clientes (BRIEF §7.2).
// Server-only. Devuelve los campos base + derivados (lastActivity, ltv, arPending,
// salesCountLast12mo) en una sola pasada para evitar N+1 al renderizar la power grid.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { listableCustomerWhere } from "./service";
import { computeSegmentChips, type SegmentChip } from "./segmentation";
import { normalizeForSearch } from "./normalize";

export interface DirectoryCustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rfc: string | null;
  isBusiness: boolean;
  tags: string[];
  shippingCity: string | null;
  shippingState: string | null;
  balance: number;
  creditLimit: number;
  deletedAt: Date | null;
  bikesCount: number;
  salesCount: number;
  salesCountLast12mo: number;
  ltv: number;
  arPending: number;
  lastSaleAt: Date | null;
  lastActivityAt: Date | null;
  communicationConsent: boolean;
  /**
   * BRIEF Sub-fase L: cliente creado vía quick-create del POS al que aún le
   * falta capturar email, RFC o dirección de envío. Sirve para que SELLER+
   * sepa cuándo completar el perfil.
   */
  profileIncomplete: boolean;
  chips: SegmentChip[];
}

export interface DirectoryFilters {
  q?: string;
  chip?: "activos" | "con-saldo" | "empresas" | "riesgo" | "inactivos" | "sin-consent" | null;
  isBusiness?: boolean;
  includeDeleted?: boolean;
}

export interface DirectoryListArgs extends DirectoryFilters {
  limit: number;
  offset: number;
}

export interface DirectoryStats {
  customersTotal: number;
  ltvAccumulated: number;
  averageTicket: number;
  accountsReceivableTotal: number;
}

const DAY = 24 * 60 * 60 * 1000;

function buildBaseWhere(filters: DirectoryFilters): Prisma.CustomerWhereInput {
  const base = listableCustomerWhere({ includeDeleted: filters.includeDeleted });

  const qClause: Prisma.CustomerWhereInput | undefined = filters.q
    ? {
        OR: [
          { nameNormalized: { contains: normalizeForSearch(filters.q) } },
          { phone: { contains: filters.q.replace(/\D/g, "") || filters.q } },
          { email: { contains: filters.q, mode: "insensitive" } },
          { rfc: { contains: filters.q.toUpperCase() } },
        ],
      }
    : undefined;

  const businessClause =
    filters.isBusiness === true
      ? { isBusiness: true }
      : filters.isBusiness === false
        ? { isBusiness: false }
        : filters.chip === "empresas"
          ? { isBusiness: true }
          : {};

  const consentClause =
    filters.chip === "sin-consent"
      ? { communicationConsent: false, NOT: { phone: null } }
      : {};

  return {
    ...base,
    ...(qClause ?? {}),
    ...businessClause,
    ...consentClause,
  };
}

export async function listDirectoryCustomers(
  args: DirectoryListArgs,
): Promise<{ rows: DirectoryCustomerRow[]; total: number }> {
  const where = buildBaseWhere(args);

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: args.offset,
      take: args.limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        rfc: true,
        isBusiness: true,
        tags: true,
        shippingCity: true,
        shippingState: true,
        shippingStreet: true,
        creditLimit: true,
        deletedAt: true,
        communicationConsent: true,
        _count: { select: { bikes: true, sales: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  if (customers.length === 0) return { rows: [], total };

  const ids = customers.map((c) => c.id);

  // Saldo a favor desde CustomerCredit aggregate (Pack D.5/D.6 — N+1 safe).
  const creditAggregates = await prisma.customerCredit.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, expiredAt: null, balance: { gt: 0 } },
    _sum: { balance: true },
  });
  const creditTotalsByCustomer = new Map<string, number>();
  for (const row of creditAggregates) {
    creditTotalsByCustomer.set(row.customerId, Number(row._sum.balance ?? 0));
  }
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * DAY);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * DAY);

  // Enriquecimiento: ventas completadas (LTV + última venta + count 12mo),
  // apartados LAYAWAY (AR pending), y última actividad vía serviceOrders/quotations.
  const [completedAgg, layawayAgg, last12moCountAgg, lastSaleAgg, lastSoAgg, lastQuoAgg] =
    await Promise.all([
      prisma.sale.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, status: "COMPLETED" },
        _sum: { total: true },
      }),
      prisma.sale.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, status: "LAYAWAY" },
        _sum: { total: true },
      }),
      prisma.sale.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: ids },
          status: "COMPLETED",
          createdAt: { gte: twelveMonthsAgo },
        },
        _count: { _all: true },
      }),
      prisma.sale.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _max: { createdAt: true },
      }),
      prisma.serviceOrder.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _max: { createdAt: true },
      }),
      prisma.quotation.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _max: { createdAt: true },
      }),
    ]);

  const ltvMap = new Map<string, number>();
  for (const r of completedAgg) if (r.customerId) ltvMap.set(r.customerId, Number(r._sum.total ?? 0));

  const arMap = new Map<string, number>();
  for (const r of layawayAgg) if (r.customerId) arMap.set(r.customerId, Number(r._sum.total ?? 0));

  const recentCountMap = new Map<string, number>();
  for (const r of last12moCountAgg)
    if (r.customerId) recentCountMap.set(r.customerId, r._count._all);

  const lastSaleMap = new Map<string, Date>();
  for (const r of lastSaleAgg)
    if (r.customerId && r._max.createdAt) lastSaleMap.set(r.customerId, r._max.createdAt);

  const lastActivityMap = new Map<string, Date>();
  const pushActivity = (id: string, d: Date | null): void => {
    if (!d) return;
    const prev = lastActivityMap.get(id);
    if (!prev || d > prev) lastActivityMap.set(id, d);
  };
  for (const r of lastSaleAgg)
    if (r.customerId) pushActivity(r.customerId, r._max.createdAt ?? null);
  for (const r of lastSoAgg)
    if (r.customerId) pushActivity(r.customerId, r._max.createdAt ?? null);
  for (const r of lastQuoAgg)
    if (r.customerId) pushActivity(r.customerId, r._max.createdAt ?? null);

  const rows: DirectoryCustomerRow[] = customers.map((c) => {
    const ltv = ltvMap.get(c.id) ?? 0;
    const arPending = arMap.get(c.id) ?? 0;
    const salesCountLast12mo = recentCountMap.get(c.id) ?? 0;
    const lastSaleAt = lastSaleMap.get(c.id) ?? null;
    const lastActivityAt = lastActivityMap.get(c.id) ?? null;
    const balance = creditTotalsByCustomer.get(c.id) ?? 0;
    const chips = computeSegmentChips(
      {
        isBusiness: c.isBusiness,
        phone: c.phone,
        balance,
        communicationConsent: c.communicationConsent,
        salesCountLast12mo,
        lastActivityAt,
        arPending,
        balanceUpdatedAt: null,
      },
      now,
    );

    const profileIncomplete =
      !c.email && !c.rfc && !c.shippingStreet;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      rfc: c.rfc,
      isBusiness: c.isBusiness,
      tags: c.tags,
      shippingCity: c.shippingCity,
      shippingState: c.shippingState,
      balance,
      creditLimit: Number(c.creditLimit),
      deletedAt: c.deletedAt,
      bikesCount: c._count.bikes,
      salesCount: c._count.sales,
      salesCountLast12mo,
      ltv,
      arPending,
      lastSaleAt,
      lastActivityAt,
      communicationConsent: c.communicationConsent,
      profileIncomplete,
      chips,
    };
  });

  // Filtros que requieren el dato enriquecido (chip post-filter in-memory).
  const filtered = rows.filter((r) => {
    switch (args.chip) {
      case "activos":
        return r.lastActivityAt && r.lastActivityAt >= ninetyDaysAgo;
      case "con-saldo":
        return r.arPending > 0;
      case "riesgo":
        return (
          r.lastActivityAt &&
          r.lastActivityAt < ninetyDaysAgo &&
          r.lastActivityAt >= oneEightyDaysAgo
        );
      case "inactivos":
        return r.lastActivityAt === null || r.lastActivityAt < oneEightyDaysAgo;
      default:
        return true;
    }
  });

  return { rows: filtered, total };
}

export async function getDirectoryStats(filters?: DirectoryFilters): Promise<DirectoryStats> {
  const where = buildBaseWhere(filters ?? {});

  const [customersTotal, ltvAgg, purchaseCount, overdueAgg] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        status: "COMPLETED",
        customerId: { not: null },
        customer: where,
      },
    }),
    prisma.sale.count({
      where: {
        status: "COMPLETED",
        customerId: { not: null },
        customer: where,
      },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        status: "LAYAWAY",
        customerId: { not: null },
        customer: where,
      },
    }),
  ]);

  const ltv = Number(ltvAgg._sum.total ?? 0);
  const avgTicket = purchaseCount > 0 ? ltv / purchaseCount : 0;
  const overdue = Number(overdueAgg._sum.total ?? 0);

  return {
    customersTotal,
    ltvAccumulated: ltv,
    averageTicket: avgTicket,
    accountsReceivableTotal: overdue,
  };
}
