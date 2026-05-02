import { Prisma } from "@prisma/client";
import { applyCustomerCredit, type ConsumedCreditEntry } from "./customer-credit";
import type { PaymentMethod, PaymentMethodEntry } from "./validators/payment";

// Pack E.2 — helper centralizado para crear N CashTransaction(s) PAYMENT_IN
// desde un array de PaymentMethodEntry.
//
// - Guard de duplicados defense-in-depth (el Zod refinement de Pack E.1 ya
//   bloquea en el boundary; el helper se asegura de que cualquier caller
//   que construya el array post-validación tampoco viole la regla).
// - collectionStatus: ATRATO → PENDING, resto → COLLECTED (regla del schema
//   prisma/schema.prisma:363).
// - Para entries CREDIT_BALANCE invoca applyCustomerCredit(customerId, amount,
//   cashTransactionId, tx) — exige customerId presente. El consumo FIFO de
//   créditos vive en lib/customer-credit.ts (Pack D).

export type PaymentInTransactionResult = {
  id: string;
  method: PaymentMethod;
  amount: number;
};

export type CreatePaymentInArgs = {
  saleId: string;
  sessionId: string;
  userId?: string | null;
  customerId?: string | null;
  entries: PaymentMethodEntry[];
  createdAt?: Date;
};

export async function createPaymentInTransactions(
  tx: Prisma.TransactionClient,
  args: CreatePaymentInArgs,
): Promise<{
  transactions: PaymentInTransactionResult[];
  consumed: ConsumedCreditEntry[];
}> {
  const filtered = args.entries.filter((e) => e.amount > 0);
  if (filtered.length === 0) {
    return { transactions: [], consumed: [] };
  }

  const methods = filtered.map((e) => e.method);
  if (new Set(methods).size !== methods.length) {
    throw new Error(
      "createPaymentInTransactions: método de pago duplicado dentro del mismo array",
    );
  }

  const hasCreditEntry = filtered.some((e) => e.method === "CREDIT_BALANCE");
  if (hasCreditEntry && !args.customerId) {
    throw new Error(
      "createPaymentInTransactions: CREDIT_BALANCE requiere customerId",
    );
  }

  const transactions: PaymentInTransactionResult[] = [];
  const consumed: ConsumedCreditEntry[] = [];

  for (const entry of filtered) {
    const cashTx = await tx.cashTransaction.create({
      data: {
        sessionId: args.sessionId,
        userId: args.userId ?? null,
        saleId: args.saleId,
        customerId: args.customerId ?? null,
        type: "PAYMENT_IN",
        method: entry.method,
        amount: entry.amount,
        reference: entry.reference ?? null,
        collectionStatus: entry.method === "ATRATO" ? "PENDING" : "COLLECTED",
        ...(args.createdAt ? { createdAt: args.createdAt } : {}),
      },
    });

    transactions.push({ id: cashTx.id, method: entry.method, amount: entry.amount });

    if (entry.method === "CREDIT_BALANCE" && args.customerId) {
      const r = await applyCustomerCredit(args.customerId, entry.amount, cashTx.id, tx);
      consumed.push(...r.consumed);
    }
  }

  return { transactions, consumed };
}
