import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import type { Prisma, StockTransferStatus } from "@prisma/client";
import { TransferenciasReportClient } from "./transferencias-report-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export interface TransferenciaRow {
  id: string;
  folio: string;
  status: string;
  createdAt: string;
  fromBranchName: string;
  toBranchName: string;
  creadoPorNombre: string;
  totalItems: number;
  cantidadTotalEnviada: number;
  cantidadTotalRecibida: number;
  motivoCancelacion: string | null;
}

export interface TransferenciasKpis {
  totalEnRango: number;
  enTransito: number;
  recibidas: number;
  canceladas: number;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface TransferenciasReportFilters {
  from: string;
  to: string;
  status: string;
  fromBranchId: string;
  toBranchId: string;
  q: string;
}

function getString(val: string | string[] | undefined): string {
  if (!val) return "";
  return Array.isArray(val) ? (val[0] ?? "") : val;
}

const VALID_STATUSES: StockTransferStatus[] = [
  "SOLICITADA",
  "BORRADOR",
  "EN_TRANSITO",
  "RECIBIDA",
  "CANCELADA",
];

export default async function TransferenciasReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  const { from: fromDate, to: toDate } = parseDateRange({
    from: getString(params.from) || undefined,
    to: getString(params.to) || undefined,
  });

  const filterStatus = getString(params.status);
  const filterFromBranchId = isAdmin ? getString(params.fromBranchId) : "";
  const filterToBranchId = isAdmin ? getString(params.toBranchId) : "";
  const filterQ = getString(params.q).trim();
  const page = Math.max(1, parseInt(getString(params.page) || "1"));
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StockTransferWhereInput = {
    createdAt: { gte: fromDate, lte: toDate },
  };

  if (user.role === "MANAGER") {
    where.OR = [
      { fromBranchId: user.branchId! },
      { toBranchId: user.branchId! },
    ];
  } else if (isAdmin) {
    if (filterFromBranchId) where.fromBranchId = filterFromBranchId;
    if (filterToBranchId) where.toBranchId = filterToBranchId;
  }

  if (filterStatus && (VALID_STATUSES as string[]).includes(filterStatus)) {
    where.status = filterStatus as StockTransferStatus;
  }
  if (filterQ) where.folio = { contains: filterQ, mode: "insensitive" };

  const kpiBase: Prisma.StockTransferWhereInput = {
    createdAt: { gte: fromDate, lte: toDate },
  };
  if (user.role === "MANAGER") {
    kpiBase.OR = [
      { fromBranchId: user.branchId! },
      { toBranchId: user.branchId! },
    ];
  }

  const [transfers, total, enTransito, recibidas, canceladas, branchesForFilter] =
    await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          folio: true,
          status: true,
          createdAt: true,
          motivoCancelacion: true,
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
          creadoPorUser: { select: { name: true } },
          items: { select: { cantidadEnviada: true, cantidadRecibida: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.count({ where: { ...kpiBase, status: "EN_TRANSITO" } }),
      prisma.stockTransfer.count({ where: { ...kpiBase, status: "RECIBIDA" } }),
      prisma.stockTransfer.count({ where: { ...kpiBase, status: "CANCELADA" } }),
      isAdmin
        ? prisma.branch.findMany({
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve<BranchOption[]>([]),
    ]);

  const rows: TransferenciaRow[] = transfers.map((t) => ({
    id: t.id,
    folio: t.folio,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    fromBranchName: t.fromBranch.name,
    toBranchName: t.toBranch.name,
    creadoPorNombre: t.creadoPorUser?.name ?? "—",
    totalItems: t.items.length,
    cantidadTotalEnviada: t.items.reduce((s, i) => s + i.cantidadEnviada, 0),
    cantidadTotalRecibida: t.items.reduce((s, i) => s + (i.cantidadRecibida ?? 0), 0),
    motivoCancelacion: t.motivoCancelacion,
  }));

  const kpis: TransferenciasKpis = {
    totalEnRango: total,
    enTransito,
    recibidas,
    canceladas,
  };

  const currentFilters: TransferenciasReportFilters = {
    from: toDateString(fromDate),
    to: toDateString(toDate),
    status: filterStatus,
    fromBranchId: filterFromBranchId,
    toBranchId: filterToBranchId,
    q: filterQ,
  };

  return (
    <TransferenciasReportClient
      rows={rows}
      kpis={kpis}
      branches={branchesForFilter}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}
