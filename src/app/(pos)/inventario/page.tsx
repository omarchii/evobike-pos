import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUserOrRedirect } from "@/lib/auth-guards";
import { KardexClient } from "./kardex-client";
import type { VariantRow, SimpleRow, BranchOption } from "./kardex-client";
import type { Prisma } from "@prisma/client";

async function getVariantAvailability(variantIds: string[], branchId: string) {
  if (variantIds.length === 0) return { workshop: {}, assembly: {}, transit: {} };

  const [workshopRows, batteryRows, transitRows] = await Promise.all([
    prisma.serviceOrderItem.groupBy({
      by: ["productVariantId"],
      where: {
        productVariantId: { in: variantIds },
        inventoryMovementId: null,
        serviceOrder: {
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          branchId,
        },
      },
      _sum: { quantity: true },
    }),
    prisma.battery.findMany({
      where: {
        status: "IN_STOCK",
        assemblyOrderId: { not: null },
        assemblyOrder: { status: "PENDING" },
        branchId,
        lot: { productVariantId: { in: variantIds } },
      },
      select: { lot: { select: { productVariantId: true } } },
    }),
    prisma.stockTransferItem.groupBy({
      by: ["productVariantId"],
      where: {
        productVariantId: { in: variantIds },
        transfer: { status: "EN_TRANSITO", toBranchId: branchId },
      },
      _sum: { cantidadEnviada: true },
    }),
  ]);

  const workshop: Record<string, number> = {};
  for (const r of workshopRows) {
    if (r.productVariantId) workshop[r.productVariantId] = r._sum.quantity ?? 0;
  }

  const assembly: Record<string, number> = {};
  for (const r of batteryRows) {
    const vid = r.lot.productVariantId;
    if (vid) assembly[vid] = (assembly[vid] ?? 0) + 1;
  }

  const transit: Record<string, number> = {};
  for (const r of transitRows) {
    if (r.productVariantId) transit[r.productVariantId] = r._sum.cantidadEnviada ?? 0;
  }

  return { workshop, assembly, transit };
}

async function getSimpleAvailability(simpleIds: string[], branchId: string) {
  if (simpleIds.length === 0) return { workshop: {}, transit: {} };

  const [workshopRows, transitRows] = await Promise.all([
    prisma.serviceOrderItem.groupBy({
      by: ["simpleProductId"],
      where: {
        simpleProductId: { in: simpleIds },
        inventoryMovementId: null,
        serviceOrder: {
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          branchId,
        },
      },
      _sum: { quantity: true },
    }),
    prisma.stockTransferItem.groupBy({
      by: ["simpleProductId"],
      where: {
        simpleProductId: { in: simpleIds },
        transfer: { status: "EN_TRANSITO", toBranchId: branchId },
      },
      _sum: { cantidadEnviada: true },
    }),
  ]);

  const workshop: Record<string, number> = {};
  for (const r of workshopRows) {
    if (r.simpleProductId) workshop[r.simpleProductId] = r._sum.quantity ?? 0;
  }

  const transit: Record<string, number> = {};
  for (const r of transitRows) {
    if (r.simpleProductId) transit[r.simpleProductId] = r._sum.cantidadEnviada ?? 0;
  }

  return { workshop, transit };
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface SearchParams {
  kind?: string;
  page?: string;
  q?: string;
  branch?: string;
  distPendiente?: string;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  const user = requireBranchedUserOrRedirect(session, "/");

  const params = await searchParams;
  const kind = params.kind === "simple" ? "simple" : "variant";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const q = (params.q ?? "").trim();
  const isAdmin = user.role === "ADMIN";
  const distPendiente = params.distPendiente === "1";

  const activeBranchId = isAdmin && params.branch ? params.branch : user.branchId;

  const branches: BranchOption[] = isAdmin
    ? (await prisma.branch.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }))
    : [{ id: user.branchId, name: "", code: "" }];

  if (kind === "variant") {
    const baseWhere: Prisma.ProductVariantWhereInput = {
      isActive: true,
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { modelo: { nombre: { contains: q, mode: "insensitive" } } },
              { color: { nombre: { contains: q, mode: "insensitive" } } },
              { voltaje: { label: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const where: Prisma.ProductVariantWhereInput = {
      ...baseWhere,
      ...(distPendiente ? { precioDistribuidorConfirmado: false } : {}),
    };

    const [rawVariants, totalVariants, totalSimples, pendienteCount] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        include: {
          stocks: { where: { branchId: activeBranchId } },
          modelo: true,
          color: true,
          voltaje: true,
          capacidad: true,
        },
        orderBy: { sku: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.productVariant.count({ where }),
      prisma.simpleProduct.count({ where: { isActive: true } }),
      prisma.productVariant.count({
        where: { isActive: true, precioDistribuidorConfirmado: false },
      }),
    ]);

    const variantIds = rawVariants.map((v) => v.id);
    const avail = await getVariantAvailability(variantIds, activeBranchId);

    const variantRows: VariantRow[] = rawVariants.map((v) => {
      const ahSuffix = v.capacidad ? ` · ${v.capacidad.nombre}` : "";
      return {
        id: v.id,
        sku: v.sku,
        name: `${v.modelo.nombre} ${v.color.nombre} ${v.voltaje.label}${ahSuffix}`,
        price: Number(v.precioPublico),
        cost: Number(v.costo),
        stock: v.stocks[0]?.quantity ?? 0,
        stockMinimo: v.stockMinimo,
        workshopPending: avail.workshop[v.id] ?? 0,
        assemblyPending: avail.assembly[v.id] ?? 0,
        enCamino: avail.transit[v.id] ?? 0,
        precioDistribuidorConfirmado: v.precioDistribuidorConfirmado,
      };
    });

    return (
      <KardexClient
        kind="variant"
        variantRows={variantRows}
        simpleRows={[]}
        total={totalVariants}
        page={page}
        pageSize={PAGE_SIZE}
        q={q}
        variantCount={totalVariants}
        simpleCount={totalSimples}
        branches={branches}
        selectedBranch={activeBranchId}
        isAdmin={isAdmin}
        precioDistPendiente={distPendiente}
        pendienteCount={pendienteCount}
      />
    );
  }

  // kind === "simple"
  const where: Prisma.SimpleProductWhereInput = {
    isActive: true,
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } },
            { descripcion: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rawSimples, totalSimples, totalVariants] = await Promise.all([
    prisma.simpleProduct.findMany({
      where,
      include: {
        stocks: { where: { branchId: activeBranchId } },
      },
      orderBy: { nombre: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.simpleProduct.count({ where }),
    prisma.productVariant.count({ where: { isActive: true } }),
  ]);

  const simpleIds = rawSimples.map((s) => s.id);
  const availSimple = await getSimpleAvailability(simpleIds, activeBranchId);

  const simpleRows: SimpleRow[] = rawSimples.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    categoria: s.categoria,
    price: Number(s.precioPublico),
    cost: Number(s.costoInterno),
    stock: s.stocks[0]?.quantity ?? 0,
    stockMinimo: s.stockMinimo,
    workshopPending: availSimple.workshop[s.id] ?? 0,
    enCamino: availSimple.transit[s.id] ?? 0,
  }));

  return (
    <KardexClient
      kind="simple"
      variantRows={[]}
      simpleRows={simpleRows}
      total={totalSimples}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      variantCount={totalVariants}
      simpleCount={totalSimples}
      branches={branches}
      selectedBranch={activeBranchId}
      isAdmin={isAdmin}
      precioDistPendiente={false}
      pendienteCount={0}
    />
  );
}
