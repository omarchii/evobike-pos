import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";

// Helpers puros para crons del módulo Saldo a Favor (Pack D.1 P6).
//
// Contrato: `(prisma, opts?: { now?: Date }) => Promise<JobResult>`.
// Idempotentes via flags en CustomerCredit (`expiredAt`, `alertSentAt`).
// Re-corridas son no-op una vez los flags están seteados.
//
// El hub `/api/cron/runs/daily` invoca con `Promise.allSettled` para aislar errores.
// También invocables sin HTTP via `tsx scripts/run-job.ts saldo-favor` (futuro).

export type JobResult = {
  processedCount: number;
  errorCount: number;
  errorMessage: string | null;
};

/**
 * Marca como vencidos los CustomerCredits cuyo `expiresAt` ya pasó.
 * NO toca `balance` — preserva audit trail. Reporte mensual "saldo perdido"
 * usa `expiredAt BETWEEN [mes_inicio, mes_fin]`.
 */
export async function expirarCreditos(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();

  const result = await prisma.customerCredit.updateMany({
    where: {
      expiresAt: { lt: now },
      expiredAt: null,
    },
    data: { expiredAt: now },
  });

  return {
    processedCount: result.count,
    errorCount: 0,
    errorMessage: null,
  };
}

/**
 * Marca para alerta los CustomerCredits con balance > 0 sin uso desde 90+ días
 * Y sin alerta enviada aún. La notificación efectiva (WhatsApp/email) se
 * conecta en Pack F INT-6 — por ahora solo se setea `alertSentAt`.
 */
export async function enviarAlertas90d(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const result = await prisma.customerCredit.updateMany({
    where: {
      balance: { gt: 0 },
      createdAt: { lt: cutoff },
      alertSentAt: null,
    },
    data: { alertSentAt: now },
  });

  return {
    processedCount: result.count,
    errorCount: 0,
    errorMessage: null,
  };
}
