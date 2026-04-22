import { Prisma } from "@prisma/client";

/**
 * TTL (en milisegundos) para `ServiceOrderApproval.expiresAt`.
 * Hardcoded a 48h en P13-D.2; parametrizar por sucursal si Fase 6 lo pide.
 */
export const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;

/** Calcula el `expiresAt` para un approval recién creado. */
export function computeApprovalExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + APPROVAL_TTL_MS);
}

/**
 * Lazy expiry: marca como REJECTED todas las approvals PENDING de la orden
 * cuyo `expiresAt < now`. Idempotente (segura ante races: dos llamadas
 * concurrentes no producen efecto duplicado).
 *
 * Limpia `subStatus = WAITING_APPROVAL` de la orden si quedó alguna
 * vencida — porque sin approvals abiertas la orden no debería seguir
 * trabada esperando una respuesta.
 *
 * @returns número de approvals expiradas en esta llamada (0 si ya estaban).
 */
export async function expirePendingApprovalsTx(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  serviceOrderId: string,
): Promise<number> {
  const now = new Date();
  const expired = await tx.serviceOrderApproval.updateMany({
    where: {
      serviceOrderId,
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: {
      status: "REJECTED",
      respondedAt: now,
      respondedNote: "EXPIRED",
    },
  });

  if (expired.count > 0) {
    await tx.serviceOrder.updateMany({
      where: { id: serviceOrderId, subStatus: "WAITING_APPROVAL" },
      data: { subStatus: null },
    });
  }

  return expired.count;
}
