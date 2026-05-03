import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUserOrRedirect } from "@/lib/auth-guards";
import { KardexClient } from "./kardex-client";
import type { VariantRow, SimpleRow, BranchOption } from "./kardex-client";
import type { Prisma } from "@prisma/client";

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

  const simpleRows: SimpleRow[] = rawSimples.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    categoria: s.categoria,
    price: Number(s.precioPublico),
    cost: Number(s.costoInterno),
    stock: s.stocks[0]?.quantity ?? 0,
    stockMinimo: s.stockMinimo,
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
