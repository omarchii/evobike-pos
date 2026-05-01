// Smoke D.4.a — verifica que getCustomerSaldoData retorna shape correcto
// para un customer con CustomerCredit MIGRACION_INICIAL (los 5 backfilled en D.1).

import { prisma } from "@/lib/prisma";
import { getCustomerSaldoData } from "@/lib/customers/profile-saldo-data";

async function main(): Promise<void> {
  const sampleCredit = await prisma.customerCredit.findFirst({
    where: { origenTipo: "MIGRACION_INICIAL" },
    select: {
      customerId: true,
      customer: { select: { name: true } },
    },
  });

  if (!sampleCredit) {
    console.error("[smoke] No hay CustomerCredit MIGRACION_INICIAL — ¿se corrió D.1 backfill?");
    process.exit(1);
  }

  console.log(
    `[smoke] Cliente sample: ${sampleCredit.customer?.name ?? "(sin nombre)"} (id=${sampleCredit.customerId})`,
  );

  const data = await getCustomerSaldoData(sampleCredit.customerId);

  console.log("\n=== Saldo data ===");
  console.log(`total=${data.total}`);
  console.log(`legacyBalance=${data.legacyBalance}`);
  console.log(`drift=${Math.abs(data.total - data.legacyBalance).toFixed(2)}`);
  console.log(`active=${data.active.length}`);
  console.log(`expired=${data.expired.length}`);
  console.log(`consumptions=${data.consumptions.length}`);

  console.log("\n=== Active credits ===");
  for (const c of data.active) {
    console.log(
      `  - id=${c.id.slice(0, 8)} origen=${c.origenTipo} balance=${c.balance}/${c.monto} expires=${c.expiresAt.toISOString().slice(0, 10)} migrationFlag=${c.isMigracionInicial}`,
    );
  }

  // Sanity: si es MIGRACION_INICIAL debe tener flag visible en UI.
  const migracionRows = data.active.filter((c) => c.isMigracionInicial);
  if (migracionRows.length > 0) {
    console.log(
      `\n[OK] ${migracionRows.length} credito(s) MIGRACION_INICIAL → UI mostrará Chip CLIENT-PENDING-G2`,
    );
  }

  // Sanity: total debería ser SUM(active.balance).
  const sumActive = data.active.reduce((s, c) => s + c.balance, 0);
  if (Math.abs(sumActive - data.total) > 0.01) {
    console.error(`[FAIL] total (${data.total}) != SUM(active.balance) (${sumActive})`);
    process.exit(1);
  }
  console.log(`[OK] total === SUM(active.balance) === ${data.total}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
