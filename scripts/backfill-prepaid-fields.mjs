// scripts/backfill-prepaid-fields.mjs
// One-shot backfill para poblar ServiceOrder.prepaidAt / prepaidAmount
// en órdenes donde prepaid=true pero esos campos son null (data legacy
// pre-Hotfix.1 y pre-E.2). Corre idempotente — si ya no quedan
// candidatas, imprime el conteo y termina.
//
// Pack E.7 (2026-05-02): el campo prepaidMethod fue dropeado del schema.
// Los consumers derivan ahora desde Sale.payments[] vía
// derivePrepaidMethodFromPayments. Este script ya no asigna prepaidMethod.
//
// Uso: node scripts/backfill-prepaid-fields.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        prepaidAt: firstAt,
        prepaidAmount: sum,
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
