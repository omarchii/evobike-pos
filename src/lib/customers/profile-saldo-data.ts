// Datos server-side para el tab "Saldo a favor" del perfil de cliente
// (Pack D.4.a). Lee CustomerCredit + CreditConsumption directo, NO Customer.balance.
//
// SELLER puede ver. MANAGER ajusta vía AJUSTE_MANAGER (rechargeCustomerCredit).

import { prisma } from "@/lib/prisma";
import type { OrigenCredito } from "@prisma/client";

export interface ActiveCreditRow {
  id: string;
  monto: number;
  balance: number;
  origenTipo: OrigenCredito;
  origenId: string | null;
  notes: string | null;
  createdAt: Date;
  expiresAt: Date;
  alertSentAt: Date | null;
  /** true si fue creado por Migration 2 — UI muestra etiqueta CLIENT-PENDING-G2. */
  isMigracionInicial: boolean;
}

export interface ExpiredCreditRow {
  id: string;
  monto: number;
  balanceLost: number;
  origenTipo: OrigenCredito;
  createdAt: Date;
  expiresAt: Date;
  expiredAt: Date;
}

export interface ConsumptionRow {
  id: string;
  amount: number;
  createdAt: Date;
  customerCreditId: string;
  cashTransactionId: string;
  saleFolio: string | null;
  saleId: string | null;
  cashTransactionType: string;
}

export interface SaldoData {
  total: number;
  active: ActiveCreditRow[];
  expired: ExpiredCreditRow[];
  consumptions: ConsumptionRow[];
  /** Customer.balance legacy — para evidencia de drift mientras shadow-write activo (Pack D.1-D.5). */
  legacyBalance: number;
}

export async function getCustomerSaldoData(customerId: string): Promise<SaldoData> {
  const [activeRaw, expiredCredits, consumptions, customer] = await Promise.all([
    prisma.customerCredit.findMany({
      where: {
        customerId,
        expiredAt: null,
        balance: { gt: 0 },
      },
      orderBy: { expiresAt: "asc" },
      select: {
        id: true,
        monto: true,
        balance: true,
        origenTipo: true,
        origenId: true,
        notes: true,
        createdAt: true,
        expiresAt: true,
        alertSentAt: true,
      },
    }),
    prisma.customerCredit.findMany({
      where: { customerId, expiredAt: { not: null } },
      orderBy: { expiredAt: "desc" },
      take: 50,
      select: {
        id: true,
        monto: true,
        balance: true,
        origenTipo: true,
        createdAt: true,
        expiresAt: true,
        expiredAt: true,
      },
    }),
    prisma.creditConsumption.findMany({
      where: { customerCredit: { customerId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        cashTransaction: {
          select: {
            type: true,
            sale: { select: { id: true, folio: true } },
          },
        },
      },
    }),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { balance: true },
    }),
  ]);

  const active: ActiveCreditRow[] = activeRaw.map((c) => ({
    id: c.id,
    monto: Number(c.monto),
    balance: Number(c.balance),
    origenTipo: c.origenTipo,
    origenId: c.origenId,
    notes: c.notes,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
    alertSentAt: c.alertSentAt,
    isMigracionInicial: c.origenTipo === "MIGRACION_INICIAL",
  }));

  const total = active.reduce((sum, c) => sum + c.balance, 0);

  const expired: ExpiredCreditRow[] = expiredCredits.map((c) => ({
    id: c.id,
    monto: Number(c.monto),
    balanceLost: Number(c.balance),
    origenTipo: c.origenTipo,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
    expiredAt: c.expiredAt!,
  }));

  const consumptionRows: ConsumptionRow[] = consumptions.map((cc) => ({
    id: cc.id,
    amount: Number(cc.amount),
    createdAt: cc.createdAt,
    customerCreditId: cc.customerCreditId,
    cashTransactionId: cc.cashTransactionId,
    saleFolio: cc.cashTransaction.sale?.folio ?? null,
    saleId: cc.cashTransaction.sale?.id ?? null,
    cashTransactionType: cc.cashTransaction.type,
  }));

  return {
    total,
    active,
    expired,
    consumptions: consumptionRows,
    legacyBalance: customer ? Number(customer.balance) : 0,
  };
}
