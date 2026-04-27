import type { SessionUser } from "@/lib/auth-types";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { serializeDecimal } from "@/lib/reportes/money";
import { ClientesClient } from "./clientes-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  branchId?: string;
  hasPending?: string;
}

export interface ClienteRow {
  id: string;
  name: string;
  phone: string;
  comprasCount: number;
  totalComprado: number;
  apartadosCount: number;
  saldoPendiente: number;
  saldoAFavor: number;
  ultimaActividadISO: string | null;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface ClientesKpis {
  clientesActivos: number;
  apartadosActivos: number;
  saldoPendienteTotal: number;
  saldoAFavorTotal: number;
}

export interface ClientesCurrentFilters {
  q: string;
  branchId: string;
  hasPending: string;
}

export default async function ClientesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (
    user.role !== "ADMIN" &&
    user.role !== "MANAGER" &&
    user.role !== "SELLER"
  ) {
    redirect("/");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filterBranchId = isAdmin ? (params.branchId ?? "") : "";
  const hasPendingFlag = params.hasPending === "true";

  const scope = branchWhere(
    { role: user.role, branchId: user.branchId },
    filterBranchId || undefined,
  );
  const branchFilter: { branchId?: string } =
    scope.branchId !== undefined ? { branchId: scope.branchId } : {};

  // ── 1. IDs de clientes con actividad en la sucursal en scope ──────────────
  // Los clientes son globales, pero solo se exponen si tienen Sale o Quotation
  // en la sucursal del usuario (o en la sucursal filtrada por ADMIN).
  const [saleCustomerIds, quotationCustomerIds] = await Promise.all([
    prisma.sale.findMany({
      where: { ...branchFilter, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    prisma.quotation.findMany({
      where: { ...branchFilter, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
  ]);

  const activeCustomerIdSet = new Set<string>();
  for (const s of saleCustomerIds) {
    if (s.customerId) activeCustomerIdSet.add(s.customerId);
  }
  for (const q2 of quotationCustomerIds) {
    if (q2.customerId) activeCustomerIdSet.add(q2.customerId);
  }
  const activeCustomerIds = Array.from(activeCustomerIdSet);

  // ── 2. Traer customers con filtro de búsqueda ──────────────────────────────
  const qFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { phone2: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [customers, branches] = await Promise.all([
    prisma.customer.findMany({
      where: {
        id: { in: activeCustomerIds },
        ...qFilter,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    }),
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  const customerIds = customers.map((c) => c.id);

  // ── 3. Agregados por cliente en batch (N+1 safe) ───────────────────────────
  const [completedAgg, layawaySales, lastSaleAgg] = await Promise.all([
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        ...branchFilter,
        customerId: { in: customerIds },
        status: "COMPLETED",
        excludeFromRevenue: false,
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.sale.findMany({
      where: {
        ...branchFilter,
        customerId: { in: customerIds },
        status: "LAYAWAY",
      },
      select: {
        id: true,
        customerId: true,
        total: true,
        payments: {
          where: { type: "PAYMENT_IN" },
          select: { amount: true },
        },
      },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        ...branchFilter,
        customerId: { in: customerIds },
      },
      _max: { createdAt: true },
    }),
  ]);

  const completedMap = new Map<string, { count: number; total: number }>();
  for (const a of completedAgg) {
    if (!a.customerId) continue;
    completedMap.set(a.customerId, {
      count: a._count._all,
      total: serializeDecimal(a._sum.total),
    });
  }

  const apartadosMap = new Map<string, { count: number; pending: number }>();
  for (const sale of layawaySales) {
    if (!sale.customerId) continue;
    const paid = sale.payments.reduce(
      (acc, p) => acc + serializeDecimal(p.amount),
      0,
    );
    const pending = Math.max(0, serializeDecimal(sale.total) - paid);
    const existing = apartadosMap.get(sale.customerId);
    if (existing) {
      existing.count += 1;
      existing.pending += pending;
    } else {
      apartadosMap.set(sale.customerId, { count: 1, pending });
    }
  }

  const lastActivityMap = new Map<string, Date>();
  for (const a of lastSaleAgg) {
    if (!a.customerId || !a._max.createdAt) continue;
    lastActivityMap.set(a.customerId, a._max.createdAt);
  }

  // ── 4. Construir filas ─────────────────────────────────────────────────────
  let rows: ClienteRow[] = customers.map((c) => {
    const completed = completedMap.get(c.id) ?? { count: 0, total: 0 };
    const apartados = apartadosMap.get(c.id) ?? { count: 0, pending: 0 };
    const balance = serializeDecimal(c.balance);
    const lastActivity = lastActivityMap.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone ?? "—",
      comprasCount: completed.count,
      totalComprado: completed.total,
      apartadosCount: apartados.count,
      saldoPendiente: apartados.pending,
      saldoAFavor: balance > 0 ? balance : 0,
      ultimaActividadISO: lastActivity ? lastActivity.toISOString() : null,
    };
  });

  if (hasPendingFlag) {
    rows = rows.filter((r) => r.saldoPendiente > 0);
  }

  rows.sort((a, b) => {
    if (b.saldoPendiente !== a.saldoPendiente) {
      return b.saldoPendiente - a.saldoPendiente;
    }
    const at = a.ultimaActividadISO
      ? new Date(a.ultimaActividadISO).getTime()
      : 0;
    const bt = b.ultimaActividadISO
      ? new Date(b.ultimaActividadISO).getTime()
      : 0;
    return bt - at;
  });

  const kpis: ClientesKpis = {
    clientesActivos: rows.length,
    apartadosActivos: rows.reduce((a, r) => a + r.apartadosCount, 0),
    saldoPendienteTotal: rows.reduce((a, r) => a + r.saldoPendiente, 0),
    saldoAFavorTotal: rows.reduce((a, r) => a + r.saldoAFavor, 0),
  };

  const currentFilters: ClientesCurrentFilters = {
    q,
    branchId: filterBranchId,
    hasPending: hasPendingFlag ? "true" : "",
  };

  return (
    <ClientesClient
      rows={rows}
      kpis={kpis}
      branches={branches}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      userRole={user.role}
    />
  );
}
