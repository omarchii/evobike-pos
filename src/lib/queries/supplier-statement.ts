// Helper Pack D.bis (sub-fase C.6).
//
// Agrega PurchaseReceipt + CashTransaction por supplierId para construir el
// estado de cuenta del proveedor desde día 1 (mientras los strings legacy
// `proveedor`/`beneficiary` siguen vivos hasta el cutover atómico C.7).
//
// El helper IGNORA `BatteryLot.supplierId`: los lotes son consecuencia de un
// `PurchaseReceipt` (vía `purchaseReceiptId`) y agregarlos por separado
// duplicaría facturado. Si en el futuro existen lotes sin recepción
// asociada, el caller debe sumarlos aparte.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface InventoryReceiptRow {
  id: string;
  branchId: string;
  branchName: string;
  proveedor: string;
  folioFacturaProveedor: string | null;
  formaPagoProveedor: "CONTADO" | "CREDITO" | "TRANSFERENCIA";
  estadoPago: "PAGADA" | "PENDIENTE" | "CREDITO";
  fechaVencimiento: string | null;
  fechaPago: Date | null;
  totalPagado: number;
  createdAt: Date;
}

export interface ExpenseRow {
  id: string;
  amount: number;
  expenseCategory: string | null;
  notes: string | null;
  beneficiary: string | null;
  createdAt: Date;
  branchId: string;
  branchName: string;
}

export interface InventoryTotals {
  count: number;
  countPagadas: number;
  countPendientes: number;
  totalFacturado: number;
  totalPagado: number;
  totalPendiente: number;
  vencidasCount: number;
  vencidasTotal: number;
  proximoVencimiento: string | null; // YYYY-MM-DD
}

export interface ExpenseTotals {
  count: number;
  total: number;
  porCategoria: Array<{ category: string; count: number; total: number }>;
}

export interface SupplierStatement {
  inventory: {
    totals: InventoryTotals;
    rows: InventoryReceiptRow[];
  };
  expenses: {
    totals: ExpenseTotals;
    rows: ExpenseRow[];
  };
}

const RECEIPT_LIMIT = 200;
const EXPENSE_LIMIT = 200;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function decToNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  if (typeof d === "number") return d;
  return Number(d);
}

export async function getSupplierStatement(
  supplierId: string,
): Promise<SupplierStatement> {
  const [receipts, expenses] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where: { supplierId },
      select: {
        id: true,
        branchId: true,
        proveedor: true,
        folioFacturaProveedor: true,
        formaPagoProveedor: true,
        estadoPago: true,
        fechaVencimiento: true,
        fechaPago: true,
        totalPagado: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECEIPT_LIMIT,
    }),
    prisma.cashTransaction.findMany({
      where: { supplierId, type: "EXPENSE_OUT" },
      select: {
        id: true,
        amount: true,
        expenseCategory: true,
        notes: true,
        beneficiary: true,
        createdAt: true,
        session: { select: { branchId: true, branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: EXPENSE_LIMIT,
    }),
  ]);

  const today = todayISO();

  const invRows: InventoryReceiptRow[] = receipts.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branch.name,
    proveedor: r.proveedor,
    folioFacturaProveedor: r.folioFacturaProveedor,
    formaPagoProveedor: r.formaPagoProveedor,
    estadoPago: r.estadoPago,
    fechaVencimiento: r.fechaVencimiento,
    fechaPago: r.fechaPago,
    totalPagado: decToNumber(r.totalPagado),
    createdAt: r.createdAt,
  }));

  const inventoryTotals = invRows.reduce<InventoryTotals>(
    (acc, r) => {
      acc.count += 1;
      acc.totalFacturado += r.totalPagado;
      if (r.estadoPago === "PAGADA") {
        acc.countPagadas += 1;
        acc.totalPagado += r.totalPagado;
      } else {
        acc.countPendientes += 1;
        acc.totalPendiente += r.totalPagado;
        if (r.fechaVencimiento) {
          if (r.fechaVencimiento < today) {
            acc.vencidasCount += 1;
            acc.vencidasTotal += r.totalPagado;
          }
          if (acc.proximoVencimiento === null || r.fechaVencimiento < acc.proximoVencimiento) {
            acc.proximoVencimiento = r.fechaVencimiento;
          }
        }
      }
      return acc;
    },
    {
      count: 0,
      countPagadas: 0,
      countPendientes: 0,
      totalFacturado: 0,
      totalPagado: 0,
      totalPendiente: 0,
      vencidasCount: 0,
      vencidasTotal: 0,
      proximoVencimiento: null,
    },
  );

  const expRows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    amount: decToNumber(e.amount),
    expenseCategory: e.expenseCategory,
    notes: e.notes,
    beneficiary: e.beneficiary,
    createdAt: e.createdAt,
    branchId: e.session.branchId,
    branchName: e.session.branch.name,
  }));

  const byCategory = new Map<string, { count: number; total: number }>();
  for (const e of expRows) {
    const key = e.expenseCategory ?? "OTRO";
    const cur = byCategory.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += e.amount;
    byCategory.set(key, cur);
  }

  const expenseTotals: ExpenseTotals = {
    count: expRows.length,
    total: expRows.reduce((sum, e) => sum + e.amount, 0),
    porCategoria: Array.from(byCategory.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total),
  };

  return {
    inventory: { totals: inventoryTotals, rows: invRows },
    expenses: { totals: expenseTotals, rows: expRows },
  };
}
