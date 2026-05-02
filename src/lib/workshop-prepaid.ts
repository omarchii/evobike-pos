import type { PaymentMethod } from "@prisma/client";

/**
 * Pack E.7 — deriva el "método de prepago" desde Sale.payments[].
 *
 * Regla:
 *   payments.length === 1 → payments[0].method
 *   payments.length  > 1  → null (split; el enum PaymentMethod no tiene MIXED
 *                           y agregarlo contamina reportes de caja).
 *
 * El campo `ServiceOrder.prepaidMethod` fue dropeado en Pack E.7. Los
 * consumers leen ahora desde `Sale.payments[]` directo.
 */
export function derivePrepaidMethodFromPayments(
  payments: { method: PaymentMethod }[],
): PaymentMethod | null {
  if (payments.length === 1) return payments[0].method;
  return null;
}
