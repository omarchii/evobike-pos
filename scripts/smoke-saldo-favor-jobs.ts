// Smoke tests para los jobs cron del Pack D.3.
// Ejecuta con: npx tsx scripts/smoke-saldo-favor-jobs.ts
//
// Cubre:
//   T1 — expirarCreditos: marca como vencidos los CC con expiresAt en pasado
//   T2 — expirarCreditos idempotente: re-run = 0 procesados
//   T3 — enviarAlertas90d: marca alertSentAt para CC con createdAt < now-90d
//   T4 — enviarAlertas90d idempotente: re-run = 0 procesados
//   T5 — detectCustomerCreditDrift: detecta diff Customer.balance vs SUM(CustomerCredit)

import { prisma } from "../src/lib/prisma";
import { detectCustomerCreditDrift } from "../src/lib/jobs/customer-credit-drift";
import { enviarAlertas90d, expirarCreditos } from "../src/lib/jobs/saldo-favor";

const TEST_PREFIX = `smoke-d3-${Date.now()}`;

async function main(): Promise<void> {
  // Setup — 3 customers
  const cExpired = await prisma.customer.create({
    data: { name: `${TEST_PREFIX}-expired` },
  });
  const cAlert = await prisma.customer.create({
    data: { name: `${TEST_PREFIX}-alert` },
  });
  const cDrift = await prisma.customer.create({
    data: { name: `${TEST_PREFIX}-drift` },
  });

  const customerIds = [cExpired.id, cAlert.id, cDrift.id];

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ago100d = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // T1 setup — CC con expiresAt = ayer (debería expirar)
    await prisma.customerCredit.create({
      data: {
        customerId: cExpired.id,
        monto: 100,
        balance: 100,
        origenTipo: "AJUSTE_MANAGER",
        notes: "smoke T1",
        expiresAt: yesterday,
      },
    });

    // T1 — expirarCreditos
    const r1 = await expirarCreditos(prisma, { now: new Date() });
    if (r1.processedCount !== 1) throw new Error(`T1: processedCount=${r1.processedCount} expected 1`);
    if (r1.errorCount !== 0) throw new Error(`T1: errorCount=${r1.errorCount} expected 0`);
    const cc1 = await prisma.customerCredit.findFirstOrThrow({
      where: { customerId: cExpired.id },
    });
    if (cc1.expiredAt === null) throw new Error("T1: expiredAt no se setteó");
    console.log("✅ T1 expirarCreditos: 1 procesado + expiredAt seteado");

    // T2 — re-run idempotente
    const r2 = await expirarCreditos(prisma, { now: new Date() });
    // Puede haber otros CC vencidos en el sistema (pre-existentes). Lo importante:
    // el de cExpired NO se vuelve a procesar (expiredAt != null). Verificamos count del set.
    // Si processedCount > 0, todos vienen de DATA pre-existente, no de nuestro test row.
    const cc2 = await prisma.customerCredit.findFirstOrThrow({
      where: { customerId: cExpired.id },
    });
    if (cc2.expiredAt!.getTime() !== cc1.expiredAt!.getTime()) {
      throw new Error("T2: expiredAt cambió en re-run");
    }
    console.log(`✅ T2 expirarCreditos idempotente: re-run no re-toca CC ya marcados (system-wide processedCount=${r2.processedCount})`);

    // T3 setup — CC con createdAt = hace 100d, balance > 0, sin alertSentAt
    // Prisma createdAt no es directamente settable (default(now())), usamos raw SQL
    await prisma.$executeRaw`
      INSERT INTO "CustomerCredit" (id, "customerId", monto, balance, "origenTipo", "createdAt", "expiresAt")
      VALUES (gen_random_uuid(), ${cAlert.id}, 200, 200, 'DEVOLUCION', ${ago100d}, ${future})
    `;

    // T3 — enviarAlertas90d
    const r3 = await enviarAlertas90d(prisma, { now: new Date() });
    if (r3.processedCount < 1) throw new Error(`T3: processedCount=${r3.processedCount} expected >= 1`);
    const cc3 = await prisma.customerCredit.findFirstOrThrow({
      where: { customerId: cAlert.id },
    });
    if (cc3.alertSentAt === null) throw new Error("T3: alertSentAt no se seteó");
    console.log("✅ T3 enviarAlertas90d: alertSentAt seteado para CC > 90d");

    // T4 — re-run idempotente
    const r4 = await enviarAlertas90d(prisma, { now: new Date() });
    const cc4 = await prisma.customerCredit.findFirstOrThrow({
      where: { customerId: cAlert.id },
    });
    if (cc4.alertSentAt!.getTime() !== cc3.alertSentAt!.getTime()) {
      throw new Error("T4: alertSentAt cambió en re-run");
    }
    console.log(`✅ T4 enviarAlertas90d idempotente: alertSentAt no se re-escribe (system-wide processedCount=${r4.processedCount})`);

    // T5 setup — recharge $200 (crea CC + Customer.balance = 200), luego romper invariante
    await prisma.$transaction(async (tx) => {
      await tx.customerCredit.create({
        data: {
          customerId: cDrift.id,
          monto: 200,
          balance: 200,
          origenTipo: "AJUSTE_MANAGER",
          notes: "smoke T5",
          expiresAt: future,
        },
      });
      await tx.customer.update({
        where: { id: cDrift.id },
        data: { balance: 200 },
      });
    });

    // Romper invariante: subir balance directo (simular bug legacy)
    await prisma.customer.update({
      where: { id: cDrift.id },
      data: { balance: 250 },
    });

    // T5 — detectCustomerCreditDrift
    const r5 = await detectCustomerCreditDrift(prisma);
    if (r5.errorCount < 1) throw new Error(`T5: errorCount=${r5.errorCount} expected >= 1`);
    if (!r5.errorMessage || !r5.errorMessage.includes("Drift")) {
      throw new Error(`T5: errorMessage no menciona drift: ${r5.errorMessage}`);
    }
    console.log(`✅ T5 detectCustomerCreditDrift: detectó ${r5.errorCount} cliente(s) con drift (esperado durante D.2-D.5 transition)`);

    console.log("\n🎉 All smoke tests passed (5/5)");
  } finally {
    // Cleanup
    await prisma.customerCredit.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    console.log("🧹 Test data limpia");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Smoke failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
