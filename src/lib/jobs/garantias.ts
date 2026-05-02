import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";
import { send } from "@/lib/whatsapp/dispatch";

export type JobResult = {
  processedCount: number;
  errorCount: number;
  errorMessage: string | null;
};

const BATCH_SIZE = 100;

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function alertarPolizas(
  prisma: PrismaClient | typeof globalPrisma,
  opts: { now?: Date; dayThreshold: number; field: "alertSentAt120" | "alertSentAt173"; templateKey: string },
): Promise<JobResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - opts.dayThreshold * 24 * 60 * 60 * 1000);
  let processedCount = 0;
  let errorCount = 0;
  let lastError: string | null = null;

  let batch;
  do {
    batch = await prisma.warrantyPolicy.findMany({
      where: {
        status: "ACTIVE",
        [opts.field]: null,
        startedAt: { lte: cutoff },
      },
      include: {
        customerBike: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            branch: { select: { name: true } },
            productVariant: {
              select: { modelo: { select: { nombre: true } } },
            },
          },
        },
      },
      take: BATCH_SIZE,
    });

    for (const policy of batch) {
      try {
        const bike = policy.customerBike;
        const customer = bike.customer;
        if (!customer?.phone) {
          await prisma.warrantyPolicy.update({
            where: { id: policy.id, [opts.field]: null },
            data: { [opts.field]: now },
          });
          processedCount++;
          continue;
        }

        await (prisma as typeof globalPrisma).$transaction(async (tx) => {
          await tx.warrantyPolicy.update({
            where: { id: policy.id, [opts.field]: null },
            data: { [opts.field]: now },
          });

          const modeloBici =
            bike.productVariant?.modelo?.nombre ?? bike.model ?? "tu equipo";

          await send({
            templateKey: opts.templateKey,
            customerId: customer.id,
            recipientPhone: customer.phone!,
            variables: {
              nombreCliente: customer.name,
              modeloBici,
              serie: bike.serialNumber,
              fechaVencimiento: formatDate(policy.expiresAt),
              sucursalNombre: bike.branch.name,
            },
            expiresAt:
              opts.field === "alertSentAt120"
                ? new Date(
                    policy.startedAt.getTime() + 173 * 24 * 60 * 60 * 1000,
                  )
                : policy.expiresAt,
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

export async function alertar120d(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  return alertarPolizas(prisma, {
    now: opts?.now,
    dayThreshold: 120,
    field: "alertSentAt120",
    templateKey: "WARRANTY_ALERT_120D",
  });
}

export async function alertar173d(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  return alertarPolizas(prisma, {
    now: opts?.now,
    dayThreshold: 173,
    field: "alertSentAt173",
    templateKey: "WARRANTY_ALERT_173D",
  });
}

export async function expirarPolizas(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  opts?: { now?: Date },
): Promise<JobResult> {
  const now = opts?.now ?? new Date();

  const result = await prisma.warrantyPolicy.updateMany({
    where: {
      status: "ACTIVE",
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
