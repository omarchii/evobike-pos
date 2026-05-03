import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";
import { GHOST_RESERVATION_TTL_DAYS } from "@/lib/config";
import type { JobResult } from "@/lib/jobs/saldo-favor";

/**
 * Scans for ServiceOrders stuck in non-terminal status (not DELIVERED/CANCELLED)
 * whose updatedAt is older than GHOST_RESERVATION_TTL_DAYS.
 *
 * These "ghost" OTs inflate workshop_pending in the I3a disponible formula.
 * The ghost filter already excludes them from the formula; this job reports
 * them so admins can investigate and close them manually.
 *
 * Scope: ServiceOrder only. AssemblyOrder PENDING is short-lived by design
 * and excluded from ghost-reservation hygiene (decision I.3.b 2026-05-03).
 */
export async function reportarGhostReservations(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - GHOST_RESERVATION_TTL_DAYS);

  const staleOrders = await prisma.serviceOrder.findMany({
    where: {
      status: { notIn: ["DELIVERED", "CANCELLED"] },
      updatedAt: { lt: cutoff },
      items: {
        some: {
          inventoryMovementId: null,
          OR: [
            { productVariantId: { not: null } },
            { simpleProductId: { not: null } },
          ],
        },
      },
    },
    select: { folio: true, branchId: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });

  if (staleOrders.length === 0) {
    return { processedCount: 0, errorCount: 0, errorMessage: null };
  }

  const folios = staleOrders.map((o) => o.folio).join(", ");
  const msg = `${staleOrders.length} OTs ghost (>${GHOST_RESERVATION_TTL_DAYS}d sin actividad, con ítems sin despachar): ${folios}`;

  return {
    processedCount: staleOrders.length,
    errorCount: 0,
    errorMessage: msg.slice(0, 500),
  };
}
