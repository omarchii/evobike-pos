import { z } from "zod";

// Pack E.1 — fuente única de verdad del shape de método de pago.
//
// Shape flat por compat con CashTransaction.reference (String? libre).
// `reference` cubre voucher CARD, ref TRANSFER, contractId ATRATO sin tipar.
//
// La unicidad por método es per-submission: un mismo array no debe contener
// dos entradas con el mismo `method`. Layaway abonos legítimamente crean N
// CashTransactions con mismo method en momentos distintos (cada submit es un
// array independiente). Ver Pack C.1 Q7 INT-2 + scripts/diagnose-payment-duplicates.ts.

export const paymentMethodEnum = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "CREDIT_BALANCE",
  "ATRATO",
]);

export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const paymentMethodEntrySchema = z.object({
  method: paymentMethodEnum,
  amount: z.number().nonnegative(),
  reference: z.string().optional(),
});

export type PaymentMethodEntry = z.infer<typeof paymentMethodEntrySchema>;

export const paymentMethodsArraySchema = z
  .array(paymentMethodEntrySchema)
  .min(1, "Al menos un método de pago requerido")
  .refine(
    (entries) => new Set(entries.map((e) => e.method)).size === entries.length,
    {
      message:
        "No se permite el mismo método de pago duplicado dentro de una misma transacción",
    },
  );
