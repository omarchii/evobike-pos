import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { formatProducto, computeMermaUnidades } from "@/lib/reportes/transferencias";
import type { Prisma } from "@prisma/client";
import { MermasReportClient } from "./mermas-report-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export interface MermaRow {
  transferId: string;
  folio: string;
  recibidoAt: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchName: string;
  productName: string;
  productVariantId: string | null;
  simpleProductId: string | null;
  cantidadEnviada: number;
  cantidadRecibida: number;
  mermaUnidades: number;
  pctMerma: number;
}

export interface MermasKpis {
  totalItemsConMerma: number;
  unidadesPerdidas: number;
  transferenciasAfectadas: number;
  sucursalOrigenTopNombre: string;
  sucursalOrigenTopCount: number;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface MermasReportFilters {
  from: string;
  to: string;
  fromBranchId: string;
  toBranchId: string;
  agruparPor: "detalle" | "producto" | "sucursal";
}

function getString(val: string | string[] | undefined): string {
  if (!val) return "";
  return Array.isArray(val) ? (val[0] ?? "") : val;
}

function parseAgruparPor(val: string): "detalle" | "producto" | "sucursal" {
  if (val === "producto" || val === "sucursal") return val;
  return "detalle";
}

export default async function MermasReportPage({
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

  const filterFromBranchId = isAdmin ? getString(params.fromBranchId) : "";
  const filterToBranchId = isAdmin ? getString(params.toBranchId) : "";
  const agruparPor = parseAgruparPor(getString(params.agruparPor));

  const where: Prisma.StockTransferWhereInput = {
    status: "RECIBIDA",
    recibidoAt: { gte: fromDate, lte: toDate },
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

  const [transfers, branchesForFilter] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      orderBy: { recibidoAt: "desc" },
      select: {
        id: true,
        folio: true,
        recibidoAt: true,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            cantidadEnviada: true,
            cantidadRecibida: true,
            productVariantId: true,
            simpleProductId: true,
            productVariant: {
              select: {
                id: true,
                modelo: { select: { nombre: true } },
                color: { select: { nombre: true } },
                voltaje: { select: { label: true } },
              },
            },
            simpleProduct: { select: { id: true, nombre: true } },
          },
        },
      },
    }),
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  const mermaRows: MermaRow[] = [];
  for (const transfer of transfers) {
    for (const item of transfer.items) {
      const merma = computeMermaUnidades(item.cantidadEnviada, item.cantidadRecibida);
      if (merma <= 0) continue;
      mermaRows.push({
        transferId: transfer.id,
        folio: transfer.folio,
        recibidoAt: transfer.recibidoAt!.toISOString(),
        fromBranchId: transfer.fromBranch.id,
        fromBranchName: transfer.fromBranch.name,
        toBranchName: transfer.toBranch.name,
        productName: formatProducto(item),
        productVariantId: item.productVariantId,
        simpleProductId: item.simpleProductId,
        cantidadEnviada: item.cantidadEnviada,
        cantidadRecibida: item.cantidadRecibida ?? 0,
        mermaUnidades: merma,
        pctMerma: Math.round((merma / item.cantidadEnviada) * 100),
      });
    }
  }

  // KPI: top origen branch by frequency
  const branchCounts = new Map<string, { nombre: string; count: number }>();
  for (const row of mermaRows) {
    const entry = branchCounts.get(row.fromBranchId);
    if (entry) {
      entry.count++;
    } else {
      branchCounts.set(row.fromBranchId, { nombre: row.fromBranchName, count: 1 });
    }
  }
  let topBranch = { nombre: "—", count: 0 };
  for (const entry of branchCounts.values()) {
    if (entry.count > topBranch.count) topBranch = entry;
  }

  const transferIds = new Set(mermaRows.map((r) => r.transferId));

  const kpis: MermasKpis = {
    totalItemsConMerma: mermaRows.length,
    unidadesPerdidas: mermaRows.reduce((s, r) => s + r.mermaUnidades, 0),
    transferenciasAfectadas: transferIds.size,
    sucursalOrigenTopNombre: topBranch.nombre,
    sucursalOrigenTopCount: topBranch.count,
  };

  const currentFilters: MermasReportFilters = {
    from: toDateString(fromDate),
    to: toDateString(toDate),
    fromBranchId: filterFromBranchId,
    toBranchId: filterToBranchId,
    agruparPor,
  };

  return (
    <MermasReportClient
      mermaRows={mermaRows}
      kpis={kpis}
      branches={branchesForFilter}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
    />
  );
}
