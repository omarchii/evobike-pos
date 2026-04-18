import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { resolveCostsBatch } from "@/lib/reportes/cost-resolver";
import { computeLineRevenues } from "@/lib/reportes/line-revenue";
import { serializeDecimal } from "@/lib/reportes/money";
import { RentabilidadClient } from "./rentabilidad-client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── Tipos del session user ─────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

// ── Tipos serializados para el Client Component ───────────────────────────────

export type CostSource = "RECEIPT" | "CATALOG" | "NONE";

export interface ProductoRow {
  key: string;
  kind: "variant" | "simple";
  codigo: string;
  nombre: string;
  unidades: number;
  revenueNeto: number;
  costoTotal: number;
  margen: number;
  margenPct: number;
  ticketPromedio: number;
  costSource: CostSource;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface RentabilidadFilters {
  from: string;
  to: string;
  branchId: string;
  kind: string;
  sort: string;
}

export interface RentabilidadKpis {
  revenueNetoTotal: number;
  costoTotal: number;
  margenBruto: number;
  margenPct: number;
  lineasLibresCount: number;
}

// ── Tipos Prisma para la query ────────────────────────────────────────────────

type SaleForRentabilidad = Prisma.SaleGetPayload<{
  select: {
    id: true;
    discount: true;
    items: {
      select: {
        id: true;
        productVariantId: true;
        simpleProductId: true;
        isFreeForm: true;
        description: true;
        price: true;
        quantity: true;
        discount: true;
        productVariant: {
          select: {
            sku: true;
            modelo: { select: { nombre: true } };
            color: { select: { nombre: true } };
            voltaje: { select: { label: true } };
          };
        };
        simpleProduct: {
          select: {
            codigo: true;
            nombre: true;
          };
        };
      };
    };
  };
}>;

// ── Page ──────────────────────────────────────────────────────────────────────

interface SearchParams {
  from?: string;
  to?: string;
  branchId?: string;
  kind?: string;
  sort?: string;
}

export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  // ── Parsear filtros ──────────────────────────────────────────────────────
  const { from: fromDate, to: toDate } = parseDateRange({
    from: params.from,
    to: params.to,
  });

  const filterBranchId = isAdmin ? (params.branchId ?? "") : "";

  // ── Scope de sucursal ────────────────────────────────────────────────────
  const scope = branchWhere(
    { role: user.role, branchId: user.branchId },
    filterBranchId || undefined,
  );

  // ── Query principal ──────────────────────────────────────────────────────
  const [salesRaw, branches] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: fromDate, lte: toDate },
        ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
      },
      select: {
        id: true,
        discount: true,
        items: {
          select: {
            id: true,
            productVariantId: true,
            simpleProductId: true,
            isFreeForm: true,
            description: true,
            price: true,
            quantity: true,
            discount: true,
            productVariant: {
              select: {
                sku: true,
                modelo: { select: { nombre: true } },
                color: { select: { nombre: true } },
                voltaje: { select: { label: true } },
              },
            },
            simpleProduct: {
              select: {
                codigo: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<SaleForRentabilidad[]>,
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  // ── Procesamiento: acumular revenue y unidades por producto ──────────────

  // Acumular datos intermedios antes de resolver costos
  interface ProductAccum {
    kind: "variant" | "simple";
    codigo: string;
    nombre: string;
    unidades: number;
    revenueNeto: number;
    variantId: string | null;
    simpleId: string | null;
  }

  const productMap = new Map<string, ProductAccum>();
  let lineasLibresCount = 0;

  for (const sale of salesRaw) {
    // computeLineRevenues requiere Decimal en sale.discount e items
    const lineRevenues = computeLineRevenues({
      discount: sale.discount,
      items: sale.items.map((item) => ({
        id: item.id,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount,
      })),
    });

    for (const item of sale.items) {
      const revenue = lineRevenues.get(item.id);
      if (!revenue) continue;

      const isLibre =
        item.isFreeForm === true ||
        (item.productVariantId == null && item.simpleProductId == null);

      if (isLibre) {
        lineasLibresCount += 1;
        continue;
      }

      let key: string;
      let accum: ProductAccum;

      if (item.productVariantId) {
        key = `v:${item.productVariantId}`;
        const existing = productMap.get(key);
        if (existing) {
          existing.unidades += item.quantity;
          existing.revenueNeto += revenue.revenueNeto;
        } else {
          const pv = item.productVariant;
          const nombre = pv
            ? `${pv.modelo.nombre} ${pv.color.nombre} ${pv.voltaje.label}`.trim()
            : "Producto desconocido";
          accum = {
            kind: "variant",
            codigo: pv?.sku ?? "—",
            nombre,
            unidades: item.quantity,
            revenueNeto: revenue.revenueNeto,
            variantId: item.productVariantId,
            simpleId: null,
          };
          productMap.set(key, accum);
        }
      } else if (item.simpleProductId) {
        key = `s:${item.simpleProductId}`;
        const existing = productMap.get(key);
        if (existing) {
          existing.unidades += item.quantity;
          existing.revenueNeto += revenue.revenueNeto;
        } else {
          const sp = item.simpleProduct;
          accum = {
            kind: "simple",
            codigo: sp?.codigo ?? "—",
            nombre: sp?.nombre ?? "Producto desconocido",
            unidades: item.quantity,
            revenueNeto: revenue.revenueNeto,
            variantId: null,
            simpleId: item.simpleProductId,
          };
          productMap.set(key, accum);
        }
      }
    }
  }

  // ── Resolver costos en un solo batch ────────────────────────────────────
  const variantIds: string[] = [];
  const simpleIds: string[] = [];

  for (const [key, accum] of productMap.entries()) {
    if (accum.kind === "variant" && accum.variantId) {
      variantIds.push(accum.variantId);
    } else if (accum.kind === "simple" && accum.simpleId) {
      simpleIds.push(accum.simpleId);
    }
    void key;
  }

  const costMap = await resolveCostsBatch(variantIds, simpleIds);

  // ── Construir filas serializadas ─────────────────────────────────────────
  const productoRows: ProductoRow[] = [];

  for (const [key, accum] of productMap.entries()) {
    const resolved = costMap.get(key);
    const costoUnitario = resolved?.cost ?? 0;
    const costoTotal = costoUnitario * accum.unidades;
    const margen = accum.revenueNeto - costoTotal;
    const margenPct =
      accum.revenueNeto > 0 ? (margen / accum.revenueNeto) * 100 : 0;
    const ticketPromedio =
      accum.unidades > 0 ? accum.revenueNeto / accum.unidades : 0;

    productoRows.push({
      key,
      kind: accum.kind,
      codigo: accum.codigo,
      nombre: accum.nombre,
      unidades: accum.unidades,
      revenueNeto: accum.revenueNeto,
      costoTotal,
      margen,
      margenPct,
      ticketPromedio,
      costSource: (resolved?.source ?? "NONE") as CostSource,
    });
  }

  // ── KPIs globales ────────────────────────────────────────────────────────
  let revenueNetoTotal = 0;
  let costoTotalGlobal = 0;

  for (const row of productoRows) {
    revenueNetoTotal += row.revenueNeto;
    costoTotalGlobal += row.costoTotal;
  }

  const margenBruto = revenueNetoTotal - costoTotalGlobal;
  const margenPct =
    revenueNetoTotal > 0 ? (margenBruto / revenueNetoTotal) * 100 : 0;

  const kpis: RentabilidadKpis = {
    revenueNetoTotal,
    costoTotal: costoTotalGlobal,
    margenBruto,
    margenPct,
    lineasLibresCount,
  };

  // ── Filtros actuales ─────────────────────────────────────────────────────
  const currentFilters: RentabilidadFilters = {
    from: toDateString(fromDate),
    to: toDateString(new Date(toDate.getTime() - 1)),
    branchId: filterBranchId,
    kind: params.kind ?? "all",
    sort: params.sort ?? "margen-desc",
  };

  // Serializar cualquier Decimal residual (ya son number, pero por seguridad)
  const serializedRows: ProductoRow[] = productoRows.map((r) => ({
    ...r,
    revenueNeto: Number(r.revenueNeto),
    costoTotal: Number(r.costoTotal),
    margen: Number(r.margen),
    margenPct: Number(r.margenPct),
    ticketPromedio: Number(r.ticketPromedio),
    unidades: Number(r.unidades),
  }));

  return (
    <RentabilidadClient
      rows={serializedRows}
      kpis={kpis}
      branches={branches}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      userRole={user.role}
    />
  );
}
