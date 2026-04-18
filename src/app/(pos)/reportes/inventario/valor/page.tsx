import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { resolveCostsBatch } from "@/lib/reportes/cost-resolver";
import { ValorInventarioClient } from "./valor-client";

export const dynamic = "force-dynamic";

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

// ── Row shapes (exportados para el Client Component) ──────────────────────────

export interface ValorInventarioRow {
  stockId: string;
  /** Discriminador: exactamente uno de variantId / simpleId es non-null */
  kind: "variant" | "simple";
  branchId: string;
  branchName: string;
  branchCode: string;
  // Campos variante
  variantId: string | null;
  sku: string | null;
  modelo: string | null;
  color: string | null;
  voltaje: string | null;
  // Campos simple
  simpleId: string | null;
  codigo: string | null;
  nombre: string | null;
  // Campos comunes
  quantity: number;
  costoUnitario: number;
  costSource: "RECEIPT" | "CATALOG" | "NONE";
  valorTotal: number;
}

export interface ValorInventarioKpis {
  valorTotal: number;
  valorVariants: number;
  valorSimples: number;
  productosDistintos: number;
  sucursalesConStock: number;
}

export interface SucursalOption {
  id: string;
  name: string;
  code: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ValorInventarioPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    redirect("/");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;
  const branchIdParam = isAdmin ? getString(params.branchId) : undefined;

  if (!isAdmin && !user.branchId) redirect("/");

  // ── Query principal ──────────────────────────────────────────────────────
  const stocks = await prisma.stock.findMany({
    where: {
      quantity: { gt: 0 },
      ...branchWhere({ role: user.role, branchId: user.branchId }, branchIdParam),
    },
    include: {
      productVariant: {
        include: { modelo: true, color: true, voltaje: true },
      },
      simpleProduct: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  // ── Extraer IDs para el batch de costos ──────────────────────────────────
  const variantIds: string[] = [];
  const simpleIds: string[] = [];

  for (const s of stocks) {
    if (s.productVariantId !== null) variantIds.push(s.productVariantId);
    else if (s.simpleProductId !== null) simpleIds.push(s.simpleProductId);
  }

  const costMap = await resolveCostsBatch(variantIds, simpleIds);

  // ── Serializar filas ──────────────────────────────────────────────────────
  const rows: ValorInventarioRow[] = stocks
    .map((s): ValorInventarioRow | null => {
      const isVariant = s.productVariant !== null && s.productVariantId !== null;
      const isSimple = s.simpleProduct !== null && s.simpleProductId !== null;

      if (!isVariant && !isSimple) return null;

      const costKey = isVariant
        ? `v:${s.productVariantId!}`
        : `s:${s.simpleProductId!}`;

      const resolved = costMap.get(costKey) ?? {
        cost: 0,
        source: "NONE" as const,
        currency: "MXN" as const,
      };

      const costoUnitario = resolved.cost;
      const valorTotal = s.quantity * costoUnitario;

      if (isVariant) {
        const v = s.productVariant!;
        return {
          stockId: s.id,
          kind: "variant",
          branchId: s.branchId,
          branchName: s.branch.name,
          branchCode: s.branch.code,
          variantId: v.id,
          sku: v.sku,
          modelo: v.modelo.nombre,
          color: v.color.nombre,
          voltaje: v.voltaje.label,
          simpleId: null,
          codigo: null,
          nombre: null,
          quantity: s.quantity,
          costoUnitario,
          costSource: resolved.source,
          valorTotal,
        };
      } else {
        const p = s.simpleProduct!;
        return {
          stockId: s.id,
          kind: "simple",
          branchId: s.branchId,
          branchName: s.branch.name,
          branchCode: s.branch.code,
          variantId: null,
          sku: null,
          modelo: null,
          color: null,
          voltaje: null,
          simpleId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          quantity: s.quantity,
          costoUnitario,
          costSource: resolved.source,
          valorTotal,
        };
      }
    })
    .filter((r): r is ValorInventarioRow => r !== null)
    .sort((a, b) => b.valorTotal - a.valorTotal);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  let valorTotalSum = 0;
  let valorVariants = 0;
  let valorSimples = 0;
  const branchIdsConStock = new Set<string>();

  for (const r of rows) {
    valorTotalSum += r.valorTotal;
    if (r.kind === "variant") valorVariants += r.valorTotal;
    else valorSimples += r.valorTotal;
    branchIdsConStock.add(r.branchId);
  }

  const kpis: ValorInventarioKpis = {
    valorTotal: valorTotalSum,
    valorVariants,
    valorSimples,
    productosDistintos: rows.length,
    sucursalesConStock: branchIdsConStock.size,
  };

  // ── Sucursales para el filtro (solo ADMIN) ────────────────────────────────
  const sucursales: SucursalOption[] = isAdmin
    ? await prisma.branch
        .findMany({
          select: { id: true, code: true, name: true },
          orderBy: { name: "asc" },
        })
        .then((bs) => bs.map((b) => ({ id: b.id, name: b.name, code: b.code })))
    : [];

  return (
    <ValorInventarioClient
      rows={rows}
      kpis={kpis}
      sucursales={sucursales}
      isAdmin={isAdmin}
      currentFilters={{
        branchId: branchIdParam ?? "",
        kind: getString(params.kind) ?? "all",
        costSource: getString(params.costSource) ?? "all",
        q: getString(params.q) ?? "",
      }}
    />
  );
}
