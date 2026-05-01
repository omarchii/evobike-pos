// Smoke D.5 — verifica que post-sweep el drift detector reporta $0 en estado
// limpio del seed/migración. Si reporta > 0, hay un callsite no canalizado a
// helpers o shadow-write divergente.

import { prisma } from "../src/lib/prisma";
import { detectCustomerCreditDrift } from "../src/lib/jobs/customer-credit-drift";

async function main() {
  const result = await detectCustomerCreditDrift(prisma);
  const totalCustomers = result.processedCount;
  const driftCount = result.errorCount;

  console.log(`[smoke-d5-drift] processed=${totalCustomers} drift=${driftCount}`);

  if (driftCount === 0) {
    console.log("[smoke-d5-drift] ✅ drift = $0 — sweep airtight");
    process.exit(0);
  }

  console.error(`[smoke-d5-drift] ❌ drift detectado: ${result.errorMessage}`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
