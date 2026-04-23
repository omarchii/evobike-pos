import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/reportes/money";
import { resolveCostsBatch } from "@/lib/reportes/cost-resolver";
import { toDateString } from "@/lib/reportes/date-range";

// ── Tipos de dominio ──────────────────────────────────────────────────────────

export type ExpenseCategoryKey =
  | "RENTA"
  | "SERVICIOS"
  | "NOMINA"
  | "PUBLICIDAD"
  | "TRANSPORTE"
  | "MANTENIMIENTO_INMUEBLE"
  | "IMPUESTOS"
  | "COMISIONES_BANCARIAS"
  | "OTRO";

// PAGO_PROVEEDOR excluido: la compra de inventario ya se reconoce como COGS
// al venderse. Mostrarlo aquí genera doble conteo. Dominio real: V14 CxP.
export type CashExpenseCategoryKey =
  | "MENSAJERIA"
  | "PAPELERIA"
  | "CONSUMO"
  | "MANTENIMIENTO"
  | "LIMPIEZA"
  | "AJUSTE_CAJA"
  | "OTRO";

export const OPEX_CATEGORY_LABELS: Record<ExpenseCategoryKey, string> = {
  RENTA: "Renta",
  SERVICIOS: "Servicios",
  NOMINA: "Nómina",
  PUBLICIDAD: "Publicidad",
  TRANSPORTE: "Transporte",
  MANTENIMIENTO_INMUEBLE: "Mantenimiento inmueble",
  IMPUESTOS: "Impuestos",
  COMISIONES_BANCARIAS: "Comisiones bancarias",
  OTRO: "Otro",
};

export const CASH_EXPENSE_LABELS: Record<CashExpenseCategoryKey, string> = {
  MENSAJERIA: "Mensajería",
  PAPELERIA: "Papelería",
  CONSUMO: "Consumo",
  MANTENIMIENTO: "Mantenimiento",
  LIMPIEZA: "Limpieza",
  AJUSTE_CAJA: "Ajuste de caja",
  OTRO: "Otro",
};

export interface PnlParams {
  from: Date;
  to: Date;
  branchId: string | null;
}

export interface BranchPnlData {
  ingresos: number;
  cogs: number;
  margenBruto: number;
  opexBancario: number;
  opexBancarioByCategoria: Partial<Record<ExpenseCategoryKey, number>>;
  comisionesPagadas: number;
  gastosEfectivo: number;
  gastosEfectivoByCategoria: Partial<Record<CashExpenseCategoryKey, number>>;
  margenOperativo: number;
}

export interface TopExpenseCategory {
  name: string;
  amount: number;
  pctOfOpex: number;
  source: "bancario" | "efectivo";
}

export interface PnlData {
  byBranch: Record<string, BranchPnlData>;
  consolidated: BranchPnlData;
  sparkline: number[];
  topExpenseCategory: TopExpenseCategory | null;
  branches: Array<{ id: string; name: string; code: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export type SparklineGranularity = "daily" | "monthly";

/**
 * Elige granularidad de sparkline según el largo del rango.
 * Exportado para reuso en V13 Cashflow y V14 CxP.
 */
export function getSparklineGranularity(rangeDays: number): SparklineGranularity {
  return rangeDays < 60 ? "daily" : "monthly";
}

function buildEmptyBranchData(): BranchPnlData {
  return {
    ingresos: 0,
    cogs: 0,
    margenBruto: 0,
    opexBancario: 0,
    opexBancarioByCategoria: {},
    comisionesPagadas: 0,
    gastosEfectivo: 0,
    gastosEfectivoByCategoria: {},
    margenOperativo: 0,
  };
}

function consolidateBranchData(entries: BranchPnlData[]): BranchPnlData {
  const result = buildEmptyBranchData();
  for (const e of entries) {
    result.ingresos += e.ingresos;
    result.cogs += e.cogs;
    result.opexBancario += e.opexBancario;
    result.comisionesPagadas += e.comisionesPagadas;
    result.gastosEfectivo += e.gastosEfectivo;

    for (const [k, v] of Object.entries(e.opexBancarioByCategoria)) {
      const key = k as ExpenseCategoryKey;
      result.opexBancarioByCategoria[key] =
        (result.opexBancarioByCategoria[key] ?? 0) + (v ?? 0);
    }
    for (const [k, v] of Object.entries(e.gastosEfectivoByCategoria)) {
      const key = k as CashExpenseCategoryKey;
      result.gastosEfectivoByCategoria[key] =
        (result.gastosEfectivoByCategoria[key] ?? 0) + (v ?? 0);
    }
  }
  result.margenBruto = result.ingresos - result.cogs;
  result.margenOperativo =
    result.margenBruto -
    result.opexBancario -
    result.comisionesPagadas -
    result.gastosEfectivo;
  return result;
}

// ── Query principal ───────────────────────────────────────────────────────────

export async function fetchEstadoResultados(params: PnlParams): Promise<PnlData> {
  const { from, to, branchId } = params;

  const [sales, opexRows, commissions, cashExpenses, allBranches] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          status: { not: "CANCELLED" },
          excludeFromRevenue: false,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          branchId: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              productVariantId: true,
              simpleProductId: true,
              quantity: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),

      prisma.operationalExpense.findMany({
        where: {
          isAnulado: false,
          fecha: { gte: from, lte: to },
          metodoPago: { in: ["CARD", "TRANSFER", "CREDIT_BALANCE"] },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          branchId: true,
          monto: true,
          categoria: true,
        },
      }),

      // TODO: Si CommissionRecord gana campo paidAt en el futuro, reemplazar
      // updatedAt por paidAt como fecha de corte para las comisiones pagadas.
      prisma.commissionRecord.findMany({
        where: {
          status: "PAID",
          updatedAt: { gte: from, lte: to },
          ...(branchId ? { sale: { branchId } } : {}),
        },
        select: {
          amount: true,
          sale: { select: { branchId: true } },
        },
      }),

      prisma.cashTransaction.findMany({
        where: {
          type: "EXPENSE_OUT",
          // PAGO_PROVEEDOR excluido: la compra de inventario ya se reconoce como COGS
          // al venderse. Mostrarlo aquí genera doble conteo. Dominio real: V14 CxP.
          expenseCategory: { not: "PAGO_PROVEEDOR" },
          createdAt: { gte: from, lte: to },
          ...(branchId ? { session: { branchId } } : {}),
        },
        select: {
          amount: true,
          expenseCategory: true,
          session: { select: { branchId: true } },
        },
      }),

      prisma.branch.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      }),
    ]);

  // Resolver COGS vía batch
  const variantIds = [
    ...new Set(
      sales
        .flatMap((s) => s.items.map((i) => i.productVariantId))
        .filter((id): id is string => id !== null),
    ),
  ];
  const simpleIds = [
    ...new Set(
      sales
        .flatMap((s) => s.items.map((i) => i.simpleProductId))
        .filter((id): id is string => id !== null),
    ),
  ];
  const costMap = await resolveCostsBatch(variantIds, simpleIds);

  // Inicializar mapa por sucursal
  const relevantBranches = branchId
    ? allBranches.filter((b) => b.id === branchId)
    : allBranches;

  const branchMap = new Map<string, BranchPnlData>(
    relevantBranches.map((b) => [b.id, buildEmptyBranchData()]),
  );

  // Agregar ventas + COGS
  for (const sale of sales) {
    const entry = branchMap.get(sale.branchId);
    if (!entry) continue;

    entry.ingresos += serializeDecimal(sale.total);

    for (const item of sale.items) {
      const key = item.productVariantId
        ? `v:${item.productVariantId}`
        : item.simpleProductId
          ? `s:${item.simpleProductId}`
          : null;
      if (key) {
        entry.cogs += (costMap.get(key)?.cost ?? 0) * item.quantity;
      }
    }
  }

  // Agregar gastos operativos bancarios
  for (const opex of opexRows) {
    const entry = branchMap.get(opex.branchId);
    if (!entry) continue;
    const amount = serializeDecimal(opex.monto);
    entry.opexBancario += amount;
    const cat = opex.categoria as ExpenseCategoryKey;
    entry.opexBancarioByCategoria[cat] =
      (entry.opexBancarioByCategoria[cat] ?? 0) + amount;
  }

  // Agregar comisiones pagadas (por sale.branchId)
  for (const c of commissions) {
    const entry = branchMap.get(c.sale.branchId);
    if (!entry) continue;
    entry.comisionesPagadas += serializeDecimal(c.amount);
  }

  // Agregar gastos de caja (ex-PAGO_PROVEEDOR)
  for (const ct of cashExpenses) {
    const entry = branchMap.get(ct.session.branchId);
    if (!entry) continue;
    if (!ct.expenseCategory) continue; // invariante: EXPENSE_OUT siempre tiene categoría
    const amount = serializeDecimal(ct.amount);
    entry.gastosEfectivo += amount;
    const cat = ct.expenseCategory as CashExpenseCategoryKey;
    entry.gastosEfectivoByCategoria[cat] =
      (entry.gastosEfectivoByCategoria[cat] ?? 0) + amount;
  }

  // Calcular subtotales derivados por sucursal
  for (const entry of branchMap.values()) {
    entry.margenBruto = entry.ingresos - entry.cogs;
    entry.margenOperativo =
      entry.margenBruto -
      entry.opexBancario -
      entry.comisionesPagadas -
      entry.gastosEfectivo;
  }

  const byBranch: Record<string, BranchPnlData> = Object.fromEntries(branchMap);
  const consolidated = consolidateBranchData([...branchMap.values()]);

  // Sparkline: granularidad dinámica según largo del rango
  const rangeDays =
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const granularity = getSparklineGranularity(rangeDays);

  const sparklineMap = new Map<string, number>();
  for (const sale of sales) {
    const key =
      granularity === "daily"
        ? toDateString(sale.createdAt)
        : `${sale.createdAt.getFullYear()}-${String(sale.createdAt.getMonth() + 1).padStart(2, "0")}`;
    sparklineMap.set(key, (sparklineMap.get(key) ?? 0) + serializeDecimal(sale.total));
  }
  const sparkline = [...sparklineMap.values()].slice(-14);

  // Categoría de gasto más alta (combina ambas fuentes)
  const totalOpex =
    consolidated.opexBancario +
    consolidated.comisionesPagadas +
    consolidated.gastosEfectivo;

  let topExpenseCategory: TopExpenseCategory | null = null;

  for (const [k, v] of Object.entries(consolidated.opexBancarioByCategoria)) {
    const amount = v ?? 0;
    if (!topExpenseCategory || amount > topExpenseCategory.amount) {
      topExpenseCategory = {
        name: OPEX_CATEGORY_LABELS[k as ExpenseCategoryKey] ?? k,
        amount,
        pctOfOpex: totalOpex > 0 ? amount / totalOpex : 0,
        source: "bancario",
      };
    }
  }

  for (const [k, v] of Object.entries(consolidated.gastosEfectivoByCategoria)) {
    const amount = v ?? 0;
    if (!topExpenseCategory || amount > topExpenseCategory.amount) {
      topExpenseCategory = {
        name: CASH_EXPENSE_LABELS[k as CashExpenseCategoryKey] ?? k,
        amount,
        pctOfOpex: totalOpex > 0 ? amount / totalOpex : 0,
        source: "efectivo",
      };
    }
  }

  return {
    byBranch,
    consolidated,
    sparkline,
    topExpenseCategory,
    branches: relevantBranches,
  };
}
