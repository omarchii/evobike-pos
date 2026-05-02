import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";
import type { JobResult } from "@/lib/jobs/garantias";

export async function expirarMensajesPendientes(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();

  const result = await prisma.outboundMessage.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  return {
    processedCount: result.count,
    errorCount: 0,
    errorMessage: null,
  };
}
