import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { serializeDecimal } from "@/lib/reportes/money";
import { MovimientosClient } from "./movimientos-client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── Tipos locales (no importar enums Prisma en el cliente) ────────────────────

export type MovementTypeFilter =
  | "all"
  | "SALE"
  | "RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT"
  | "PURCHASE_RECEIPT"
  | "WORKSHOP_USAGE";

export type KindFilter = "all" | "variant" | "simple";
export type SignFilter = "all" | "in" | "out";

const VALID_TYPES = [
  "SALE",
  "RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT",
  "PURCHASE_RECEIPT",
  "WORKSHOP_USAGE",
] as const;

// ── Shapes serializados ───────────────────────────────────────────────────────

export interface MovimientoRow {
  id: string;
  createdAt: string;
  type: (typeof VALID_TYPES)[number];
  quantity: number;
  sign: "in" | "out" | "neutral";
  kind: "variant" | "simple" | "unknown";
  productName: string;
  productCode: string;
  branchId: string;
  branchName: string;
  userId: string;
  userName: string;
  referenceLabel: string;
  referenceId: string | null;
  precioUnitarioPagado: number | null;
}

export interface MovimientosKpis {
  totalMovimientos: number;
  entradasTotal: number;
  salidasTotal: number;
  ajustesCount: number;
  ajustesNeto: number;
  productosDistintos: number;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface CurrentFilters {
  from: string;
  to: string;
  branchId: string;
  type: MovementTypeFilter;
  kind: KindFilter;
  sign: SignFilter;
  q: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getString(val: string | string[] | undefined): string {
  if (!val) return "";
  return Array.isArray(val) ? (val[0] ?? "") : val;
}

function parseType(val: string): MovementTypeFilter {
  if (val === "all") return "all";
  if ((VALID_TYPES as readonly string[]).includes(val)) {
    return val as (typeof VALID_TYPES)[number];
  }
  return "all";
}

function parseKind(val: string): KindFilter {
  if (val === "variant" || val === "simple") return val;
  return "all";
}

function parseSign(val: string): SignFilter {
  if (val === "in" || val === "out") return val;
  return "all";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MovimientosInventarioPage({
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

  // ── Parsear filtros ──────────────────────────────────────────────────────
  const { from: fromDate, to: toDate } = parseDateRange({
    from: getString(params.from) || undefined,
    to: getString(params.to) || undefined,
  });

  const filterBranchId = isAdmin ? getString(params.branchId) : "";
  const filterType = parseType(getString(params.type));
  const filterKind = parseKind(getString(params.kind));
  const filterSign = parseSign(getString(params.sign));
  const filterQ = getString(params.q).trim();

  // ── Scope de sucursal ────────────────────────────────────────────────────
  const scope = branchWhere(
    { role: user.role, branchId: user.branchId },
    filterBranchId || undefined,
  );

  // ── Filtro de tipo de producto (kind) ────────────────────────────────────
  const kindFilter: Prisma.InventoryMovementWhereInput =
    filterKind === "variant"
      ? { productVariantId: { not: null } }
      : filterKind === "simple"
        ? { simpleProductId: { not: null } }
        : {};

  // ── Filtro de dirección (sign) ────────────────────────────────────────────
  const signFilter: Prisma.InventoryMovementWhereInput =
    filterSign === "in"
      ? { quantity: { gt: 0 } }
      : filterSign === "out"
        ? { quantity: { lt: 0 } }
        : {};

  // ── Filtro de búsqueda por producto ──────────────────────────────────────
  const productFilter: Prisma.InventoryMovementWhereInput = filterQ
    ? {
        OR: [
          {
            productVariant: {
              sku: { contains: filterQ, mode: "insensitive" },
            },
          },
          {
            productVariant: {
              modelo: { nombre: { contains: filterQ, mode: "insensitive" } },
            },
          },
          {
            simpleProduct: {
              codigo: { contains: filterQ, mode: "insensitive" },
            },
          },
          {
            simpleProduct: {
              nombre: { contains: filterQ, mode: "insensitive" },
            },
          },
        ],
      }
    : {};

  // ── Where final ──────────────────────────────────────────────────────────
  const where: Prisma.InventoryMovementWhereInput = {
    createdAt: { gte: fromDate, lte: toDate },
    ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
    ...(filterType !== "all" ? { type: filterType } : {}),
    ...kindFilter,
    ...signFilter,
    ...productFilter,
  };

  // ── Query principal ──────────────────────────────────────────────────────
  const movements = await prisma.inventoryMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      productVariant: {
        select: {
          id: true,
          sku: true,
          modelo: { select: { nombre: true } },
          color: { select: { nombre: true } },
          voltaje: { select: { label: true } },
        },
      },
      simpleProduct: {
        select: { id: true, nombre: true, codigo: true },
      },
      purchaseReceipt: {
        select: { proveedor: true, folioFacturaProveedor: true },
      },
    },
  });

  // ── Recolectar IDs para queries batch ────────────────────────────────────
  const branchIds = new Set(movements.map((m) => m.branchId));
  const userIds = new Set(movements.map((m) => m.userId));

  const saleIds = new Set(
    movements
      .filter(
        (m) =>
          (m.type === "SALE" || m.type === "RETURN") &&
          m.referenceId !== null,
      )
      .map((m) => m.referenceId!),
  );

  const serviceOrderIds = new Set(
    movements
      .filter((m) => m.type === "WORKSHOP_USAGE" && m.referenceId !== null)
      .map((m) => m.referenceId!),
  );

  // ── Queries batch en paralelo ─────────────────────────────────────────────
  const [branches, users, sales, serviceOrders, branchesForFilter] =
    await Promise.all([
      branchIds.size > 0
        ? prisma.branch.findMany({
            where: { id: { in: [...branchIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      userIds.size > 0
        ? prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string | null }[]),
      saleIds.size > 0
        ? prisma.sale.findMany({
            where: { id: { in: [...saleIds] } },
            select: { id: true, folio: true },
          })
        : Promise.resolve([] as { id: string; folio: string }[]),
      serviceOrderIds.size > 0
        ? prisma.serviceOrder.findMany({
            where: { id: { in: [...serviceOrderIds] } },
            select: { id: true, folio: true },
          })
        : Promise.resolve([] as { id: string; folio: string }[]),
      isAdmin
        ? prisma.branch.findMany({
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);

  // ── Mapas para lookup O(1) ────────────────────────────────────────────────
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name ?? "—"]));
  const saleMap = new Map(sales.map((s) => [s.id, s.folio]));
  const serviceOrderMap = new Map(serviceOrders.map((so) => [so.id, so.folio]));

  // ── Serializar filas ──────────────────────────────────────────────────────
  const rows: MovimientoRow[] = movements.map((m) => {
    // Polimorfismo de producto
    let kind: "variant" | "simple" | "unknown" = "unknown";
    let productName = "—";
    let productCode = "—";

    if (m.productVariantId !== null && m.productVariant !== null) {
      kind = "variant";
      const pv = m.productVariant;
      productName = [pv.modelo.nombre, pv.color.nombre, pv.voltaje.label]
        .filter(Boolean)
        .join(" ");
      productCode = pv.sku;
    } else if (m.simpleProductId !== null && m.simpleProduct !== null) {
      kind = "simple";
      productName = m.simpleProduct.nombre;
      productCode = m.simpleProduct.codigo;
    }
    // Si ambos son null (violación del invariante de DB): kind = "unknown", productName = "—"

    // Dirección según convención confirmada:
    // quantity > 0 → entrada (PURCHASE_RECEIPT, RETURN, TRANSFER_IN)
    // quantity < 0 → salida (SALE, WORKSHOP_USAGE, TRANSFER_OUT)
    // quantity === 0 → neutro (ADJUSTMENT sin cambio neto)
    const sign: "in" | "out" | "neutral" =
      m.quantity > 0 ? "in" : m.quantity < 0 ? "out" : "neutral";

    // Referencia amigable por tipo
    let referenceLabel = "—";
    if (m.type === "PURCHASE_RECEIPT" && m.purchaseReceipt !== null) {
      const folio = m.purchaseReceipt.folioFacturaProveedor;
      referenceLabel = folio
        ? `${m.purchaseReceipt.proveedor} · ${folio}`
        : m.purchaseReceipt.proveedor;
    } else if (
      (m.type === "SALE" || m.type === "RETURN") &&
      m.referenceId !== null
    ) {
      const folio = saleMap.get(m.referenceId);
      referenceLabel = folio ? `Venta ${folio}` : `#${m.referenceId.slice(0, 8)}`;
    } else if (m.type === "WORKSHOP_USAGE" && m.referenceId !== null) {
      const folio = serviceOrderMap.get(m.referenceId);
      referenceLabel = folio
        ? `Orden ${folio}`
        : `#${m.referenceId.slice(0, 8)}`;
    } else if (
      (m.type === "TRANSFER_OUT" || m.type === "TRANSFER_IN") &&
      m.referenceId !== null
    ) {
      // El patrón de referenceId para transferencias no está documentado en el
      // codebase v1 — se muestra id corto con prefijo. Pendiente en v2.
      referenceLabel = `Transf. #${m.referenceId.slice(0, 8)}`;
    } else if (m.type === "ADJUSTMENT" && m.referenceId !== null) {
      referenceLabel = m.referenceId;
    }

    return {
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      type: m.type,
      quantity: m.quantity,
      sign,
      kind,
      productName,
      productCode,
      branchId: m.branchId,
      branchName: branchMap.get(m.branchId) ?? "—",
      userId: m.userId,
      userName: userMap.get(m.userId) ?? "—",
      referenceLabel,
      referenceId: m.referenceId,
      precioUnitarioPagado:
        m.precioUnitarioPagado !== null
          ? serializeDecimal(m.precioUnitarioPagado)
          : null,
    };
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  let entradasTotal = 0;
  let salidasAbsTotal = 0;
  let ajustesCount = 0;
  let ajustesNeto = 0;
  const productIds = new Set<string>();

  for (const m of movements) {
    if (m.quantity > 0) entradasTotal += m.quantity;
    if (m.quantity < 0) salidasAbsTotal += Math.abs(m.quantity);
    if (m.type === "ADJUSTMENT") {
      ajustesCount++;
      ajustesNeto += m.quantity;
    }
    if (m.productVariantId !== null) productIds.add(`v:${m.productVariantId}`);
    if (m.simpleProductId !== null) productIds.add(`s:${m.simpleProductId}`);
  }

  const kpis: MovimientosKpis = {
    totalMovimientos: movements.length,
    entradasTotal,
    salidasTotal: salidasAbsTotal,
    ajustesCount,
    ajustesNeto,
    productosDistintos: productIds.size,
  };

  const currentFilters: CurrentFilters = {
    from: toDateString(fromDate),
    to: toDateString(new Date(toDate.getTime() - 1)),
    branchId: filterBranchId,
    type: filterType,
    kind: filterKind,
    sign: filterSign,
    q: filterQ,
  };

  return (
    <MovimientosClient
      rows={rows}
      kpis={kpis}
      branches={branchesForFilter}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      userRole={user.role}
    />
  );
}
