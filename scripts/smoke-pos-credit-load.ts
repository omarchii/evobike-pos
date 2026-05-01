// Smoke D.4.c — verifica el aggregate query que el POS page.tsx usa para
// poblar `creditBalanceTotal` por customer.

import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const aggregates = await prisma.customerCredit.groupBy({
    by: ["customerId"],
    where: { expiredAt: null, balance: { gt: 0 } },
    _sum: { balance: true },
  });

  console.log(`[1] Aggregate retornó ${aggregates.length} customer(s) con saldo activo`);

  let totalSum = 0;
  for (const row of aggregates) {
    const sum = Number(row._sum.balance ?? 0);
    totalSum += sum;
    const customer = await prisma.customer.findUnique({
      where: { id: row.customerId },
      select: { name: true },
    });
    console.log(`  - ${customer?.name ?? "?"}: CC=$${sum.toFixed(2)}`);
  }
  console.log(`\n[OK] Suma total CustomerCredit activos: $${totalSum.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
