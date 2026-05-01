// Datos server-side para los tabs Finanzas y Datos del perfil de cliente
// (BRIEF §7.4 — Sub-fases H y I). Cross-sucursal: ningún loader filtra
// por `session.branchId`.

import { prisma } from "@/lib/prisma";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// === TAB FINANZAS ==========================================================

export interface LayawayBreakdown {
  id: string;
  folio: string;
  total: number;
  paid: number;
  outstanding: number;
  createdAt: Date;
  expectedDeliveryDate: Date | null;
  branchName: string;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    createdAt: Date;
  }>;
}

export interface MovementRow {
  id: string;
  createdAt: Date;
  description: string;
  type: "CHARGE" | "PAYMENT";
  amount: number;
  folio: string | null;
  folioHref: string | null;
  method: string | null;
  branchName: string | null;
}

export interface FinanzasData {
  balance: number;
  creditLimit: number;
  arPending: number;
  arOverdueDays: number | null;
  layaways: LayawayBreakdown[];
  movements: MovementRow[];
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
};

export function methodLabel(method: string | null): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? method;
}

export async function getCustomerFinanzasData(
  customerId: string,
): Promise<FinanzasData> {
  const [customer, layawaySales, cashTxns, creditBalance] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true },
    }),
    prisma.sale.findMany({
      where: { customerId, status: "LAYAWAY" },
      orderBy: { createdAt: "desc" },
      include: {
        branch: { select: { name: true } },
        payments: {
          where: { type: "PAYMENT_IN" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            amount: true,
            method: true,
            reference: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.cashTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        sale: { select: { id: true, folio: true } },
        session: { select: { branch: { select: { name: true } } } },
      },
    }),
    getCustomerCreditBalance(customerId).then((r) => r.total),
  ]);

  const now = new Date();
  const layaways: LayawayBreakdown[] = [];
  let arPending = 0;
  let arOldestOverdueAt: Date | null = null;

  for (const sale of layawaySales) {
    const total = Number(sale.total);
    const paid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = Math.max(0, total - paid);

    layaways.push({
      id: sale.id,
      folio: sale.folio,
      total,
      paid,
      outstanding,
      createdAt: sale.createdAt,
      expectedDeliveryDate: sale.expectedDeliveryDate,
      branchName: sale.branch.name,
      payments: sale.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference,
        createdAt: p.createdAt,
      })),
    });

    if (outstanding > 0) {
      arPending += outstanding;
      const expected = sale.expectedDeliveryDate;
      if (expected && expected < now) {
        if (!arOldestOverdueAt || expected < arOldestOverdueAt) {
          arOldestOverdueAt = expected;
        }
      }
    }
  }

  const arOverdueDays = arOldestOverdueAt
    ? Math.floor((now.getTime() - arOldestOverdueAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  // Movements = CashTransaction rows mapeadas a una vista unificada.
  const movements: MovementRow[] = cashTxns.map((t) => {
    const amount = Number(t.amount);
    const isCharge =
      t.type === "REFUND_OUT" ||
      t.type === "EXPENSE_OUT" ||
      t.type === "WITHDRAWAL";
    const type: MovementRow["type"] = isCharge ? "CHARGE" : "PAYMENT";

    let description: string;
    let folio: string | null = null;
    let folioHref: string | null = null;

    if (t.saleId && t.sale) {
      folio = t.sale.folio;
      folioHref = `/ventas/${t.sale.id}`;
      description =
        t.type === "REFUND_OUT"
          ? `Reembolso venta ${t.sale.folio}`
          : `Pago a venta ${t.sale.folio}`;
    } else if (t.type === "PAYMENT_IN") {
      description = "Recarga de saldo a favor";
    } else if (t.type === "REFUND_OUT") {
      description = "Reembolso / devolución";
    } else if (t.type === "EXPENSE_OUT") {
      description = "Egreso de caja";
    } else if (t.type === "WITHDRAWAL") {
      description = "Retiro de caja";
    } else {
      description = "Movimiento";
    }

    return {
      id: t.id,
      createdAt: t.createdAt,
      description,
      type,
      amount,
      folio,
      folioHref,
      method: t.method,
      branchName: t.session?.branch?.name ?? null,
    };
  });

  return {
    balance: creditBalance,
    creditLimit: customer ? Number(customer.creditLimit) : 0,
    arPending,
    arOverdueDays: arOverdueDays != null && arOverdueDays > 0 ? arOverdueDays : null,
    layaways: layaways.filter((l) => l.outstanding > 0 || l.payments.length > 0),
    movements,
  };
}

// === TAB DATOS =============================================================

export interface EditLogRow {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  authorName: string | null;
  createdAt: Date;
  customerBikeId: string | null;
}

export interface MergedSourceRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  mergedAt: Date;
  /** Días restantes en la ventana de 30d de undo; <=0 = expirada. */
  daysUntilUndoExpires: number;
}

export interface DatosData {
  base: {
    birthday: Date | null;
    createdAt: Date;
    phonePrevious: string | null;
    emailFiscal: string | null;
    razonSocial: string | null;
    regimenFiscal: string | null;
    usoCFDI: string | null;
    fiscalStreet: string | null;
    fiscalExtNum: string | null;
    fiscalIntNum: string | null;
    fiscalColonia: string | null;
    fiscalCity: string | null;
    fiscalState: string | null;
    fiscalZip: string | null;
    direccionFiscal: string | null;
    shippingStreet: string | null;
    shippingExtNum: string | null;
    shippingIntNum: string | null;
    shippingColonia: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    shippingRefs: string | null;
  };
  editLog: EditLogRow[];
  mergedSources: MergedSourceRow[];
}

const UNMERGE_WINDOW_DAYS = 30;

export async function getCustomerDatosData(
  customerId: string,
  viewerUserId: string,
  viewerIsManagerPlus: boolean,
): Promise<DatosData | null> {
  const [customer, editLogs, mergedSources] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        birthday: true,
        phonePrevious: true,
        emailFiscal: true,
        razonSocial: true,
        regimenFiscal: true,
        usoCFDI: true,
        fiscalStreet: true,
        fiscalExtNum: true,
        fiscalIntNum: true,
        fiscalColonia: true,
        fiscalCity: true,
        fiscalState: true,
        fiscalZip: true,
        direccionFiscal: true,
        shippingStreet: true,
        shippingExtNum: true,
        shippingIntNum: true,
        shippingColonia: true,
        shippingCity: true,
        shippingState: true,
        shippingZip: true,
        shippingRefs: true,
        // createdAt no existe en el schema; usamos la fecha de la venta más antigua
        // o del editLog más antiguo como proxy de "cliente desde". Si nada, null.
      },
    }),
    prisma.customerEditLog.findMany({
      where: {
        customerId,
        ...(viewerIsManagerPlus ? {} : { userId: viewerUserId }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { mergedIntoId: customerId },
      orderBy: { mergedAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        mergedAt: true,
      },
    }),
  ]);

  if (!customer) return null;

  // "Cliente desde" — proxy: la venta más antigua del cliente.
  const oldestSale = await prisma.sale.findFirst({
    where: { customerId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const createdAt = oldestSale?.createdAt ?? new Date();

  const now = new Date();
  const mergedSourcesMapped: MergedSourceRow[] = mergedSources
    .filter((m): m is typeof m & { mergedAt: Date } => m.mergedAt !== null)
    .map((m) => {
      const ageMs = now.getTime() - m.mergedAt.getTime();
      const daysElapsed = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        email: m.email,
        mergedAt: m.mergedAt,
        daysUntilUndoExpires: UNMERGE_WINDOW_DAYS - daysElapsed,
      };
    });

  return {
    base: {
      birthday: customer.birthday,
      createdAt,
      phonePrevious: customer.phonePrevious,
      emailFiscal: customer.emailFiscal,
      razonSocial: customer.razonSocial,
      regimenFiscal: customer.regimenFiscal,
      usoCFDI: customer.usoCFDI,
      fiscalStreet: customer.fiscalStreet,
      fiscalExtNum: customer.fiscalExtNum,
      fiscalIntNum: customer.fiscalIntNum,
      fiscalColonia: customer.fiscalColonia,
      fiscalCity: customer.fiscalCity,
      fiscalState: customer.fiscalState,
      fiscalZip: customer.fiscalZip,
      direccionFiscal: customer.direccionFiscal,
      shippingStreet: customer.shippingStreet,
      shippingExtNum: customer.shippingExtNum,
      shippingIntNum: customer.shippingIntNum,
      shippingColonia: customer.shippingColonia,
      shippingCity: customer.shippingCity,
      shippingState: customer.shippingState,
      shippingZip: customer.shippingZip,
      shippingRefs: customer.shippingRefs,
    },
    editLog: editLogs.map((l) => ({
      id: l.id,
      field: l.field,
      oldValue: l.oldValue,
      newValue: l.newValue,
      reason: l.reason,
      authorName: l.user?.name ?? null,
      createdAt: l.createdAt,
      customerBikeId: l.customerBikeId,
    })),
    mergedSources: mergedSourcesMapped,
  };
}
