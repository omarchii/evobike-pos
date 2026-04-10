import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import { QuotationStatus } from "@prisma/client";
import QuotationsTable from "./_components/quotations-table";
import QuotationsFilters from "./_components/quotations-filters";
import QuotationsKpiStrip from "./_components/quotations-kpi-strip";
import type { QuotationRow } from "./_components/quotations-table";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

const PAGE_SIZE = 25;

interface SearchParams {
  status?: string;
  q?: string;
  branchId?: string;
  page?: string;
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.branchId) return <div>No tienes sucursal asignada</div>;

  const { branchId, role } = user;
  const isAdmin = role === "ADMIN";

  const params = await searchParams;
  const statusParam = params.status as QuotationStatus | undefined;
  const q = params.q ?? "";
  const branchFilter = params.branchId ?? "";
  const page = Math.max(1, Number(params.page ?? "1"));

  // ── Branch filter ──────────────────────────────────────────────────────────
  const branchWhere = isAdmin
    ? branchFilter
      ? { branchId: branchFilter }
      : {}
    : { branchId };

  // ── Status filter ──────────────────────────────────────────────────────────
  // "EXPIRED" is a computed value — filter DRAFT/SENT with validUntil < now
  let statusWhere: object = {};
  if (statusParam && statusParam !== ("ALL" as QuotationStatus)) {
    if (statusParam === "EXPIRED") {
      statusWhere = {
        status: { in: ["DRAFT", "SENT"] },
        validUntil: { lt: new Date() },
      };
    } else if (statusParam === "DRAFT" || statusParam === "SENT") {
      statusWhere = {
        status: statusParam,
        validUntil: { gte: new Date() },
      };
    } else {
      statusWhere = { status: statusParam };
    }
  }

  // ── Search filter ──────────────────────────────────────────────────────────
  const searchWhere = q
    ? {
        OR: [
          { folio: { contains: q, mode: "insensitive" as const } },
          { customer: { name: { contains: q, mode: "insensitive" as const } } },
          { anonymousCustomerName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = { ...branchWhere, ...statusWhere, ...searchWhere };

  // ── KPI data ───────────────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [total, quotations, branches] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),

    isAdmin
      ? prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  // KPI queries (always use user's branch filter for KPIs, not URL filter)
  const kpiBranchWhere = isAdmin ? {} : { branchId };

  const [activeCount, convertedThisMonth, pendingValueResult, totalThisMonth] =
    await Promise.all([
      prisma.quotation.count({
        where: {
          ...kpiBranchWhere,
          status: { in: ["DRAFT", "SENT"] },
          validUntil: { gte: now },
        },
      }),
      prisma.quotation.count({
        where: {
          ...kpiBranchWhere,
          status: "CONVERTED",
          convertedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.quotation.aggregate({
        where: {
          ...kpiBranchWhere,
          status: { in: ["DRAFT", "SENT"] },
          validUntil: { gte: now },
        },
        _sum: { total: true },
      }),
      prisma.quotation.count({
        where: {
          ...kpiBranchWhere,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

  const pendingValue = Number(pendingValueResult._sum.total ?? 0);
  const conversionRate =
    totalThisMonth > 0 ? (convertedThisMonth / totalThisMonth) * 100 : 0;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const rows: QuotationRow[] = quotations.map((q) => ({
    id: q.id,
    folio: q.folio,
    status: q.status,
    validUntil: q.validUntil.toISOString(),
    createdAt: q.createdAt.toISOString(),
    total: Number(q.total),
    customerName: q.customer?.name ?? null,
    anonymousCustomerName: q.anonymousCustomerName,
    createdByName: q.user.name ?? "–",
  }));

  const searchParamsObj: Record<string, string | undefined> = {
    status: params.status,
    q: params.q,
    branchId: params.branchId,
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          Cotizaciones
        </h1>
        <Link
          href="/cotizaciones/nueva"
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
        >
          + Nueva cotización
        </Link>
      </div>

      {/* KPIs */}
      <QuotationsKpiStrip
        active={activeCount}
        convertedThisMonth={convertedThisMonth}
        pendingValue={pendingValue}
        conversionRate={conversionRate}
      />

      {/* Filters */}
      <Suspense>
        <QuotationsFilters isAdmin={isAdmin} branches={branches} />
      </Suspense>

      {/* Table */}
      <QuotationsTable
        quotations={rows}
        page={page}
        totalPages={totalPages}
        searchParams={searchParamsObj}
      />
    </div>
  );
}
