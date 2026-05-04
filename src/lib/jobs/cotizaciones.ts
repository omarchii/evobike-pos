import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";
import { send } from "@/lib/whatsapp/dispatch";

// Q.3 mod4 — crons del módulo Cotizaciones.
// Patrón Pack F (garantias.ts): job retorna `JobResult`, idempotente vía
// flags en DB (`expiredAt`, `expiringAlertSentAt`). El hub `/api/cron/runs/daily`
// invoca con `Promise.allSettled`. Re-corridas son no-op una vez los flags están seteados.

export type JobResult = {
  processedCount: number;
  errorCount: number;
  errorMessage: string | null;
};

const BATCH_SIZE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMXN(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

/**
 * Marca como EXPIRED las cotizaciones DRAFT/EN_ESPERA_CLIENTE cuyo `validUntil`
 * ya pasó. EN_ESPERA_FABRICA no expira (ya hay compromiso, spec 7.4).
 * También estampa `expiredAt = now` para audit/reportes.
 */
export async function expirarCotizaciones(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();

  const result = await prisma.quotation.updateMany({
    where: {
      status: { in: ["DRAFT", "EN_ESPERA_CLIENTE"] },
      validUntil: { lt: now },
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  });

  return {
    processedCount: result.count,
    errorCount: 0,
    errorMessage: null,
  };
}

/**
 * Avisa al cliente 24h antes de que expire la cotización (template
 * QUOTATION_EXPIRING). Solo cubre estados expirables (DRAFT, EN_ESPERA_CLIENTE).
 *
 * Idempotencia: filtra `expiringAlertSentAt IS NULL` y dentro del loop estampa
 * el flag SIEMPRE (con o sin envío). Si la cotización no tiene phone (ni
 * customer ni anonymous), marca el flag y skip — siguiendo pattern Pack F
 * garantias.ts. Esto evita que el cron re-procese el mismo registro día tras día.
 */
export async function alertarCotizacionesExpirando(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();
  const ventanaFin = new Date(now.getTime() + MS_PER_DAY);
  let processedCount = 0;
  let errorCount = 0;
  let lastError: string | null = null;

  let batch;
  do {
    batch = await prisma.quotation.findMany({
      where: {
        status: { in: ["DRAFT", "EN_ESPERA_CLIENTE"] },
        validUntil: { gt: now, lte: ventanaFin },
        expiringAlertSentAt: null,
      },
      select: {
        id: true,
        folio: true,
        validUntil: true,
        total: true,
        anonymousCustomerName: true,
        anonymousCustomerPhone: true,
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { name: true } },
      },
      take: BATCH_SIZE,
    });

    for (const quotation of batch) {
      try {
        const phone = quotation.customer?.phone ?? quotation.anonymousCustomerPhone;
        const nombreCliente =
          quotation.customer?.name ??
          quotation.anonymousCustomerName ??
          "Cliente";

        if (!phone) {
          await prisma.quotation.update({
            where: { id: quotation.id, expiringAlertSentAt: null },
            data: { expiringAlertSentAt: now },
          });
          processedCount++;
          continue;
        }

        await (prisma as typeof globalPrisma).$transaction(async (tx) => {
          await tx.quotation.update({
            where: { id: quotation.id, expiringAlertSentAt: null },
            data: { expiringAlertSentAt: now },
          });

          await send({
            templateKey: "QUOTATION_EXPIRING",
            customerId: quotation.customer?.id ?? null,
            recipientPhone: phone,
            variables: {
              nombreCliente,
              folio: quotation.folio,
              total: formatMXN(Number(quotation.total)),
              fechaVencimiento: formatDate(quotation.validUntil),
              sucursalNombre: quotation.branch.name,
            },
            expiresAt: quotation.validUntil,
            context: { source: "cron" },
            tx,
          });
        });

        processedCount++;
      } catch (e) {
        errorCount++;
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  } while (batch.length === BATCH_SIZE);

  return { processedCount, errorCount, errorMessage: lastError };
}
