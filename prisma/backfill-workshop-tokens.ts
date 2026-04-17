// Backfill idempotente de ServiceOrder.publicToken (Sub-fase A del rediseño
// del taller). Ejecutar una vez después de aplicar la migración
// 20260417162346_workshop_redesign_schema. Puede re-correrse sin efecto
// sobre órdenes que ya tienen token.
//
// Uso:
//   npx tsx prisma/backfill-workshop-tokens.ts
//   # Windows:
//   npx tsx prisma\backfill-workshop-tokens.ts

import { PrismaClient } from "@prisma/client";
import { generatePublicToken } from "../src/lib/workshop";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const pending = await prisma.serviceOrder.findMany({
    where: { publicToken: null },
    select: { id: true, folio: true },
  });

  if (pending.length === 0) {
    console.log("✓ Todas las órdenes ya tienen publicToken. Nada que hacer.");
    return;
  }

  console.log(`→ Generando publicToken para ${pending.length} orden(es)…`);

  let ok = 0;
  for (const order of pending) {
    const token = generatePublicToken();
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { publicToken: token },
    });
    ok += 1;
  }

  console.log(`✓ Backfill completo. ${ok} orden(es) actualizada(s).`);
}

main()
  .catch((err: unknown) => {
    console.error("✗ Backfill falló:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
