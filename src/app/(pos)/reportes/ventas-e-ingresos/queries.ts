import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/reportes/money";
import { resolveCostsBatch } from "@/lib/reportes/cost-resolver";
import { toDateString } from "@/lib/reportes/date-range";
import type { Prisma } from "@prisma/client";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface SalesFilters {
  from: Date;
  to: Date;
  vendedorId?: string;
  metodo?: string;
}

export interface SalesKpis {
  ingresoTotal: number;
  ticketPromedio: number;
  numVentas: number;
  margenBruto: number;
  topVendedor: { nombre: string; total: number } | null;
  sparkline: number[];
}

export interface SalesChartRow {
  fecha: string;
  contado: number;
  credito: number;
  apartado: number;
}

export interface SalesTableRow {
  id: string;
  folio: string;
  fecha: string;
  clienteNombre: string;
  vendedorNombre: string;
  metodoPago: string;
  items: number;
  subtotal: number;
  descuento: number;
  total: number;
  status: string;
}

export interface SaleDetail {
  id: string;
  folio: string;
  fecha: string;
  clienteNombre: string;
  vendedorNombre: string;
  metodoPago: string;
  subtotal: number;
  descuento: number;
  total: number;
  status: string;
  lineItems: Array<{
    id: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
  }>;
  pagos: Array<{
    id: string;
    metodo: string;
    monto: number;
  }>;
}

export interface VendedorOption {
  id: string;
  nombre: string;
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
  MIXED: "Mixto",
};

const CREDITO_METHODS = new Set(["CREDIT_BALANCE", "ATRATO"]);

function classifyPaymentMethod(methods: string[]): "contado" | "credito" | "apartado" {
  if (methods.length === 0) return "contado";
  const all = new Set(methods);
  if (all.size === 1 && CREDITO_METHODS.has([...all][0])) return "credito";
  if (methods.some((m) => CREDITO_METHODS.has(m))) return "credito";
  return "contado";
}

function getMethodLabel(methods: string[]): string {
  if (methods.length === 0) return "—";
  const unique = [...new Set(methods)];
  if (unique.length === 1) return METHOD_LABELS[unique[0]] ?? unique[0];
  return "Mixto";
}

function buildSaleWhere(
  branchId: string | null,
  filters: SalesFilters,
): Prisma.SaleWhereInput {
  const where: Prisma.SaleWhereInput = {
    status: { in: ["COMPLETED", "LAYAWAY"] },
    createdAt: { gte: filters.from, lte: filters.to },
  };

  if (branchId) where.branchId = branchId;
  if (filters.vendedorId) where.userId = filters.vendedorId;
  if (filters.metodo) {
    where.payments = { some: { method: filters.metodo as Prisma.EnumPaymentMethodFilter, type: "PAYMENT_IN" } };
  }

  return where;
}

// ── Queries exportadas ───────────────────────────────────────────────────────

export async function getSalesKpis(
  branchId: string | null,
  filters: SalesFilters,
): Promise<SalesKpis> {
  const where = buildSaleWhere(branchId, filters);

  const sales = await prisma.sale.findMany({
    where,
    select: {
      id: true,
      userId: true,
      total: true,
      subtotal: true,
      discount: true,
      status: true,
      createdAt: true,
      user: { select: { name: true } },
      items: {
        select: {
          productVariantId: true,
          simpleProductId: true,
          quantity: true,
          price: true,
          discount: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const completed = sales.filter((s) => s.status === "COMPLETED");

  // Ingreso total + vendedores map
  let ingresoTotal = 0;
  const vendedorTotals = new Map<string, { nombre: string; total: number }>();

  for (const s of completed) {
    const t = serializeDecimal(s.total);
    ingresoTotal += t;

    const existing = vendedorTotals.get(s.userId);
    if (existing) {
      existing.total += t;
    } else {
      vendedorTotals.set(s.userId, { nombre: s.user.name, total: t });
    }
  }

  const numVentas = completed.length;
  const ticketPromedio = numVentas > 0 ? ingresoTotal / numVentas : 0;

  // Top vendedor
  let topVendedor: SalesKpis["topVendedor"] = null;
  for (const v of vendedorTotals.values()) {
    if (!topVendedor || v.total > topVendedor.total) {
      topVendedor = { nombre: v.nombre, total: v.total };
    }
  }

  // Margen bruto
  const variantIds = [...new Set(
    completed.flatMap((s) => s.items.map((i) => i.productVariantId).filter((id): id is string => id !== null))
  )];
  const simpleIds = [...new Set(
    completed.flatMap((s) => s.items.map((i) => i.simpleProductId).filter((id): id is string => id !== null))
  )];

  const costMap = await resolveCostsBatch(variantIds, simpleIds);

  let cogs = 0;
  for (const s of completed) {
    for (const item of s.items) {
      const key = item.productVariantId
        ? `v:${item.productVariantId}`
        : item.simpleProductId
          ? `s:${item.simpleProductId}`
          : null;
      if (!key) continue;
      const resolved = costMap.get(key);
      cogs += (resolved?.cost ?? 0) * item.quantity;
    }
  }

  const margenBruto = ingresoTotal - cogs;

  // Sparkline: ingreso diario de los últimos 14 puntos disponibles
  const dailyMap = new Map<string, number>();
  for (const s of completed) {
    const day = toDateString(s.createdAt);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + serializeDecimal(s.total));
  }
  const sparkline = [...dailyMap.values()].slice(-14);

  return {
    ingresoTotal,
    ticketPromedio,
    numVentas,
    margenBruto,
    topVendedor,
    sparkline,
  };
}

export async function getSalesChart(
  branchId: string | null,
  filters: SalesFilters,
): Promise<SalesChartRow[]> {
  const where = buildSaleWhere(branchId, filters);

  const sales = await prisma.sale.findMany({
    where,
    select: {
      total: true,
      status: true,
      createdAt: true,
      payments: {
        where: { type: "PAYMENT_IN" },
        select: { method: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, { contado: number; credito: number; apartado: number }>();

  for (const s of sales) {
    const day = toDateString(s.createdAt);
    const total = serializeDecimal(s.total);

    if (!dailyMap.has(day)) {
      dailyMap.set(day, { contado: 0, credito: 0, apartado: 0 });
    }
    const bucket = dailyMap.get(day)!;

    if (s.status === "LAYAWAY") {
      bucket.apartado += total;
    } else {
      const methods = s.payments.map((p) => p.method);
      const cat = classifyPaymentMethod(methods);
      bucket[cat] += total;
    }
  }

  return [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }));
}

export async function getSalesTable(
  branchId: string | null,
  filters: SalesFilters,
): Promise<SalesTableRow[]> {
  const where = buildSaleWhere(branchId, filters);

  const sales = await prisma.sale.findMany({
    where,
    select: {
      id: true,
      folio: true,
      total: true,
      subtotal: true,
      discount: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
      user: { select: { name: true } },
      items: { select: { quantity: true } },
      payments: {
        where: { type: "PAYMENT_IN" },
        select: { method: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return sales.map((s) => ({
    id: s.id,
    folio: s.folio,
    fecha: s.createdAt.toISOString(),
    clienteNombre: s.customer?.name ?? "Sin cliente",
    vendedorNombre: s.user.name,
    metodoPago: getMethodLabel(s.payments.map((p) => p.method)),
    items: s.items.reduce((a, i) => a + i.quantity, 0),
    subtotal: serializeDecimal(s.subtotal),
    descuento: serializeDecimal(s.discount),
    total: serializeDecimal(s.total),
    status: s.status,
  }));
}

export async function getSaleDetail(saleId: string): Promise<SaleDetail | null> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      folio: true,
      total: true,
      subtotal: true,
      discount: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          price: true,
          discount: true,
          isFreeForm: true,
          productVariant: {
            select: {
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
            },
          },
          simpleProduct: { select: { nombre: true } },
        },
      },
      payments: {
        where: { type: "PAYMENT_IN" },
        select: { id: true, method: true, amount: true },
      },
    },
  });

  if (!sale) return null;

  return {
    id: sale.id,
    folio: sale.folio,
    fecha: sale.createdAt.toISOString(),
    clienteNombre: sale.customer?.name ?? "Sin cliente",
    vendedorNombre: sale.user.name,
    metodoPago: getMethodLabel(sale.payments.map((p) => p.method)),
    subtotal: serializeDecimal(sale.subtotal),
    descuento: serializeDecimal(sale.discount),
    total: serializeDecimal(sale.total),
    status: sale.status,
    lineItems: sale.items.map((item) => {
      const name = item.description
        ?? (item.productVariant
          ? `${item.productVariant.modelo.nombre} ${item.productVariant.color.nombre} ${item.productVariant.voltaje.label}`
          : item.simpleProduct?.nombre ?? "Producto desconocido");
      const unitPrice = serializeDecimal(item.price);
      const disc = serializeDecimal(item.discount);
      const lineSubtotal = unitPrice * item.quantity - disc;
      return {
        id: item.id,
        descripcion: name,
        cantidad: item.quantity,
        precioUnitario: unitPrice,
        descuento: disc,
        subtotal: lineSubtotal,
      };
    }),
    pagos: sale.payments.map((p) => ({
      id: p.id,
      metodo: METHOD_LABELS[p.method] ?? p.method,
      monto: serializeDecimal(p.amount),
    })),
  };
}

export async function getVendedoresOptions(branchId: string | null): Promise<VendedorOption[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      isActive: true,
      role: { in: ["SELLER", "MANAGER", "ADMIN"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, nombre: u.name }));
}
