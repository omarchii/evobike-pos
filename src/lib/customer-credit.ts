import { Prisma, type CustomerCredit, type OrigenCredito } from "@prisma/client";
import { prisma } from "./prisma";

// Helpers de saldo a favor (Pack D).
//
// G7: todos los helpers reciben tx mandatory (Prisma.TransactionClient).
// El caller es responsable de la transaction boundary — esto fuerza
// atomicidad de las escrituras a CustomerCredit + CreditConsumption.
//
// Customer.balance fue dropeado en Pack D.6 — saldo a favor vive
// 100% en CustomerCredit / CreditConsumption.

const CREDIT_VALIDITY_DAYS = 365;

export type ConsumedCreditEntry = {
  creditId: string;
  amount: number;
};

export type ActiveCreditBreakdown = {
  id: string;
  monto: number;
  balance: number;
  origenTipo: OrigenCredito;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * Aplica saldo a favor a un pago. Consume créditos no-vencidos en FIFO
 * (expiresAt ASC) y escribe CreditConsumption rows ligados al CashTransaction
 * dado.
 *
 * @throws si saldo insuficiente o si algún UPDATE viola CHECK constraint.
 */
export async function applyCustomerCredit(
  customerId: string,
  amount: number,
  cashTransactionId: string,
  tx: Prisma.TransactionClient,
): Promise<{ consumed: ConsumedCreditEntry[] }> {
  if (amount <= 0) {
    throw new Error("applyCustomerCredit: amount debe ser positivo");
  }

  const credits = await tx.customerCredit.findMany({
    where: {
      customerId,
      expiredAt: null,
      balance: { gt: 0 },
    },
    orderBy: { expiresAt: "asc" },
    select: { id: true, balance: true },
  });

  let remaining = amount;
  const consumed: ConsumedCreditEntry[] = [];

  for (const credit of credits) {
    if (remaining <= 0) break;
    const available = Number(credit.balance);
    const apply = Math.min(remaining, available);
    if (apply <= 0) continue;

    await tx.customerCredit.update({
      where: { id: credit.id },
      data: { balance: { decrement: apply } },
    });

    await tx.creditConsumption.create({
      data: {
        customerCreditId: credit.id,
        cashTransactionId,
        amount: apply,
      },
    });

    consumed.push({ creditId: credit.id, amount: apply });
    remaining -= apply;
  }

  if (remaining > 0.005) {
    throw new Error(
      `applyCustomerCredit: saldo insuficiente — falta $${remaining.toFixed(2)} de los $${amount.toFixed(2)} solicitados`,
    );
  }

  return { consumed };
}

/**
 * Saldo a favor activo del cliente. Retorna total + breakdown FIFO
 * (útil para banner POS y receipts con desglose de vencimientos).
 *
 * Acepta tx (dentro de transaction) o el cliente Prisma global (lectura
 * standalone — ej. desde API route donde el read no necesita tx).
 */
export async function getCustomerCreditBalance(
  customerId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ total: number; breakdown: ActiveCreditBreakdown[] }> {
  const credits = await client.customerCredit.findMany({
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
      createdAt: true,
      expiresAt: true,
    },
  });

  return {
    total: credits.reduce((sum, c) => sum + Number(c.balance), 0),
    breakdown: credits.map((c) => ({
      id: c.id,
      monto: Number(c.monto),
      balance: Number(c.balance),
      origenTipo: c.origenTipo,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
    })),
  };
}

/**
 * Crea un nuevo CustomerCredit (recarga manual SELLER, devolución, ajuste
 * MANAGER, apartado cancelado, etc.).
 *
 * `MIGRACION_INICIAL` está reservado para Migration 2 SQL — el helper rechaza
 * ese origenTipo para evitar dobles backfills.
 */
export async function rechargeCustomerCredit(
  customerId: string,
  monto: number,
  origen: { tipo: OrigenCredito; id?: string; notes?: string },
  tx: Prisma.TransactionClient,
): Promise<CustomerCredit> {
  if (monto <= 0) {
    throw new Error("rechargeCustomerCredit: monto debe ser positivo");
  }
  if (origen.tipo === "MIGRACION_INICIAL") {
    throw new Error(
      "rechargeCustomerCredit: MIGRACION_INICIAL solo se crea via Migration 2 SQL.",
    );
  }

  const expiresAt = new Date(Date.now() + CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  return tx.customerCredit.create({
    data: {
      customerId,
      monto,
      balance: monto,
      origenTipo: origen.tipo,
      origenId: origen.id ?? null,
      notes: origen.notes ?? null,
      expiresAt,
    },
  });
}

/**
 * Re-asigna los CustomerCredits del source al target (soft-merge de cliente).
 *
 * Idempotente: re-ejecuciones con sourceId vacío de credits son no-op.
 */
export async function mergeCustomerCredit(
  sourceId: string,
  targetId: string,
  tx: Prisma.TransactionClient,
): Promise<{ moved: number; sumMoved: number }> {
  if (sourceId === targetId) {
    throw new Error("mergeCustomerCredit: sourceId y targetId no pueden ser iguales");
  }

  const sourceCredits = await tx.customerCredit.findMany({
    where: { customerId: sourceId },
    select: { balance: true },
  });
  const sumMoved = sourceCredits.reduce((sum, c) => sum + Number(c.balance), 0);

  const updated = await tx.customerCredit.updateMany({
    where: { customerId: sourceId },
    data: { customerId: targetId },
  });

  return { moved: updated.count, sumMoved };
}
