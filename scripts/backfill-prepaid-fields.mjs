// scripts/backfill-prepaid-fields.mjs
// One-shot backfill para poblar ServiceOrder.prepaidAt / prepaidAmount /
// prepaidMethod en órdenes donde prepaid=true pero esos campos son null
// (data legacy pre-Hotfix.1 y pre-E.2). Corre idempotente — si ya no
// quedan candidatas, imprime el conteo y termina.
//
// Uso: node scripts/backfill-prepaid-fields.mjs
//
// Regla canónica de prepaidMethod (duplicada por ser .mjs sin imports TS;
// fuente canónica: src/lib/workshop-prepaid.ts::resolvePrepaidMethod y
// comment de schema.prisma sobre ServiceOrder.prepaidMethod):
//   payments.length === 1 → prepaidMethod = payments[0].method
//   payments.length  > 1  → prepaidMethod = null (split)
//
// El sum de prepaidAmount es la suma de todos los payments (split o no).
// prepaidAt es el createdAt del payment más antiguo.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function resolveMethodFromPayments(payments) {
  if (payments.length === 0) return null; // edge: sin payments
  if (payments.length > 1) return null;
  return payments[0].method;
}

async function main() {
  const orders = await prisma.serviceOrder.findMany({
    where: { prepaid: true, prepaidAt: null },
    include: { sale: { include: { payments: true } } },
  });

  if (orders.length === 0) {
    console.log("[backfill-prepaid-fields] 0 filas candidatas. Nada que hacer.");
    return;
  }

  console.log(`[backfill-prepaid-fields] ${orders.length} filas candidatas.`);

  let updated = 0;
  let skipped = 0;

  for (const order of orders) {
    const payments = order.sale?.payments ?? [];
    if (payments.length === 0) {
      console.warn(
        `[skip] ServiceOrder ${order.id}: prepaid=true pero sin CashTransaction. Requiere revisión manual.`,
      );
      skipped++;
      continue;
    }

    const sum = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const firstAt = payments
      .map((p) => p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const method = resolveMethodFromPayments(payments);

    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        prepaidAt: firstAt,
        prepaidAmount: sum,
        prepaidMethod: method,
      },
    });
    updated++;
  }

  console.log(
    `[backfill-prepaid-fields] ✅ ${updated} actualizadas · ${skipped} omitidas.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
