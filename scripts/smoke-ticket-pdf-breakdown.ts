// Smoke D.4.d — verifica el include de creditConsumptions en el query del
// ticket-pdf y la lógica de construcción del breakdown FIFO.
//
// Caso esperado al correr post-D.1 sin /api/sales wireado a applyCustomerCredit:
// breakdown vacío en TODAS las ventas (no hay CreditConsumption rows todavía).
// Post-D.5 wires, ventas con CREDIT_BALANCE deberían mostrar consumos.

import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const ventaConCreditBalance = await prisma.sale.findFirst({
    where: {
      payments: {
        some: { method: "CREDIT_BALANCE", type: "PAYMENT_IN" },
      },
    },
    include: {
      payments: {
        where: { type: "PAYMENT_IN" },
        include: {
          creditConsumptions: {
            include: {
              customerCredit: { select: { expiresAt: true } },
            },
          },
        },
      },
    },
  });

  if (!ventaConCreditBalance) {
    console.log("[1] No hay ventas con CREDIT_BALANCE — esperado pre-D.5 wires.");
    console.log("[OK] Query include compila y se ejecuta sin error.");
    await prisma.$disconnect();
    return;
  }

  console.log(`[1] Venta encontrada: ${ventaConCreditBalance.folio}`);

  const breakdown = ventaConCreditBalance.payments
    .filter((p) => p.method === "CREDIT_BALANCE")
    .flatMap((p) =>
      p.creditConsumptions.map((cc) => ({
        amount: Number(cc.amount),
        expiresAt: cc.customerCredit.expiresAt,
      })),
    )
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

  console.log(`[2] Breakdown FIFO: ${breakdown.length} entrada(s)`);
  for (const e of breakdown) {
    console.log(
      `   - $${e.amount.toFixed(2)} vence ${e.expiresAt.toISOString().slice(0, 10)}`,
    );
  }

  if (breakdown.length === 0) {
    console.log(
      "[OK] Venta usó CREDIT_BALANCE legacy (sin CreditConsumption); breakdown vacío — graceful degradation.",
    );
  } else {
    const total = breakdown.reduce((s, e) => s + e.amount, 0);
    console.log(`[OK] Total breakdown: $${total.toFixed(2)} en ${breakdown.length} CC`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
