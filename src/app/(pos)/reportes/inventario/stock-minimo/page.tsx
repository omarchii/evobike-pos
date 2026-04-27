import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StockMinimoTable } from "./stock-minimo-table";

export const dynamic = "force-dynamic";

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

// ── Row shapes ───────────────────────────────────────────────────────────────

export interface StockAlertRow {
  stockId: string;
  /** Discriminador: exactamente uno de variantId / simpleId es non-null */
  kind: "variant" | "simple";
  branchId: string;
  branchName: string;
  branchCode: string;
  quantity: number;
  stockMinimo: number;
  faltante: number; // stockMinimo - quantity
  // Campos variante (solo cuando kind === "variant")
  variantId: string | null;
  sku: string | null;
  modelo: string | null;
  color: string | null;
  voltaje: string | null;
  // Campos simple (solo cuando kind === "simple")
  simpleId: string | null;
  codigo: string | null;
  nombre: string | null;
  categoria: string | null; // SimpleProductCategoria enum value
}

export interface StockMinimoKpis {
  totalAlertas: number;
  criticas: number;
  warnings: number;
  unidadesFaltantes: number; // sum(stockMinimo - quantity)
  sucursalesConAlertas: number;
}

export interface SucursalOption {
  id: string;
  name: string;
  code: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function StockMinimoPage({
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

  const effectiveBranchId: string | null = isAdmin
    ? (branchIdParam ?? null)
    : (user.branchId ?? null);

  // Fetch stocks con stockMinimo > 0 y producto activo
  // La comparación quantity <= stockMinimo se hace en-memoria (no soportado en Prisma cross-model)
  const stocks = await prisma.stock.findMany({
    where: {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      OR: [
        { productVariant: { isActive: true, stockMinimo: { gt: 0 } } },
        { simpleProduct: { isActive: true, stockMinimo: { gt: 0 } } },
      ],
    },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      productVariant: {
        select: {
          id: true,
          sku: true,
          stockMinimo: true,
          isActive: true,
          modelo: { select: { nombre: true } },
          color: { select: { nombre: true } },
          voltaje: { select: { label: true } },
        },
      },
      simpleProduct: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          categoria: true,
          stockMinimo: true,
          isActive: true,
        },
      },
    },
  });

  // Filtrar en-memoria: quantity <= stockMinimo (solo ítems en alerta)
  const rows: StockAlertRow[] = stocks
    .map((s): StockAlertRow | null => {
      // Discriminar: exactamente uno de los dos debe estar set
      const isVariant = s.productVariant !== null && s.productVariantId !== null;
      const isSimple = s.simpleProduct !== null && s.simpleProductId !== null;

      if (!isVariant && !isSimple) return null;

      const min = isVariant
        ? (s.productVariant!.stockMinimo)
        : (s.simpleProduct!.stockMinimo);

      if (min <= 0) return null;
      if (s.quantity > min) return null;

      if (isVariant) {
        const v = s.productVariant!;
        return {
          stockId: s.id,
          kind: "variant",
          branchId: s.branchId,
          branchName: s.branch.name,
          branchCode: s.branch.code,
          quantity: s.quantity,
          stockMinimo: min,
          faltante: min - s.quantity,
          variantId: v.id,
          sku: v.sku,
          modelo: v.modelo.nombre,
          color: v.color.nombre,
          voltaje: v.voltaje.label,
          simpleId: null,
          codigo: null,
          nombre: null,
          categoria: null,
        };
      } else {
        const p = s.simpleProduct!;
        return {
          stockId: s.id,
          kind: "simple",
          branchId: s.branchId,
          branchName: s.branch.name,
          branchCode: s.branch.code,
          quantity: s.quantity,
          stockMinimo: min,
          faltante: min - s.quantity,
          variantId: null,
          sku: null,
          modelo: null,
          color: null,
          voltaje: null,
          simpleId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria,
        };
      }
    })
    .filter((r): r is StockAlertRow => r !== null)
    .sort((a, b) => a.quantity - a.stockMinimo - (b.quantity - b.stockMinimo)); // más críticos primero

  // KPIs
  const severity = (r: StockAlertRow): "critical" | "warning" =>
    r.quantity <= r.stockMinimo / 2 ? "critical" : "warning";

  const criticas = rows.filter((r) => severity(r) === "critical").length;
  const warnings = rows.filter((r) => severity(r) === "warning").length;
  const unidadesFaltantes = rows.reduce((acc, r) => acc + r.faltante, 0);
  const sucursalesConAlertas = new Set(rows.map((r) => r.branchId)).size;

  const kpis: StockMinimoKpis = {
    totalAlertas: rows.length,
    criticas,
    warnings,
    unidadesFaltantes,
    sucursalesConAlertas,
  };

  const sucursales: SucursalOption[] = isAdmin
    ? await prisma.branch
        .findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
        .then((bs) => bs.map((b) => ({ id: b.id, name: b.name, code: b.code })))
    : [];

  return (
    <StockMinimoTable
      rows={rows}
      kpis={kpis}
      sucursales={sucursales}
      isAdmin={isAdmin}
      currentFilters={{
        branchId: branchIdParam ?? "",
        kind: getString(params.kind) ?? "all",
        severity: getString(params.severity) ?? "all",
        q: getString(params.q) ?? "",
      }}
    />
  );
}
