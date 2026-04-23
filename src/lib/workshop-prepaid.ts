import type { PaymentMethod } from "@prisma/client";

/**
 * Resuelve el valor de `ServiceOrder.prepaidMethod` desde los inputs de
 * `/api/service-orders/[id]/charge`. La regla canónica vive en
 * `prisma/schema.prisma` junto a la declaración del campo:
 *
 *   payments.length === 1 → prepaidMethod = payments[0].method
 *   payments.length  > 1  → prepaidMethod = null (split; el enum PaymentMethod
 *                           no tiene MIXED y añadirlo contamina reportes de caja).
 *
 * En el flujo de /charge no existe aún el array de payments — se está
 * creando. Predecimos el conteo desde el request: hay 1 primary siempre +
 * 1 secondary si viene `secondaryPaymentMethod && secondaryAmount > 0`. Esa
 * predicción equivale a `payments.length > 1` post-transacción, por
 * construcción del endpoint.
 *
 * El backfill `scripts/backfill-prepaid-fields.mjs` replica la regla
 * leyendo `payments` directo desde DB (no puede importar TS). Mantener en
 * sync con este helper es obligación del autor del cambio.
 */
export function resolvePrepaidMethod(
  primary: PaymentMethod,
  secondary: PaymentMethod | null | undefined,
  secondaryAmount: number | null | undefined,
): PaymentMethod | null {
  const isSplit = Boolean(secondary && (secondaryAmount ?? 0) > 0);
  return isSplit ? null : primary;
}
