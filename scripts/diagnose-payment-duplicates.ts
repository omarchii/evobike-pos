// Diagnóstico Pack E.0 — duplicados de método de pago dentro de una misma venta.
//
// Ejecuta con: npx tsx scripts/diagnose-payment-duplicates.ts
//
// Detecta filas en CashTransaction donde la misma (saleId, method, type=PAYMENT_IN)
// aparece más de una vez. Clasifica cada caso:
//
//   - LAYAWAY: Sale.status = 'LAYAWAY' → legítimo (abonos secuenciales).
//   - ATRATO retry: method = ATRATO con al menos un collectionStatus
//     REJECTED|DEFAULTED|CANCELLED y al menos uno COLLECTED|PENDING → legítimo.
//   - Residual: bug latente. El refinement Zod de Pack E.1 lo bloqueará prospectivamente.
//
// One-shot. No persiste data ni muta filas.

import { prisma } from "../src/lib/prisma";

type DuplicateGroup = {
  saleId: string;
  method: string;
  cnt: number;
};

type Classified = {
  saleId: string;
  method: string;
  cnt: number;
  saleStatus: string;
  statuses: string[];
  category: "LAYAWAY" | "ATRATO_RETRY" | "RESIDUAL_BUG";
};

async function main() {
  const groups = await prisma.$queryRaw<DuplicateGroup[]>`
    SELECT "saleId", "method"::text, CAST(COUNT(*) AS INT) as cnt
    FROM "CashTransaction"
    WHERE "type" = 'PAYMENT_IN' AND "saleId" IS NOT NULL
    GROUP BY "saleId", "method"
    HAVING COUNT(*) > 1
    ORDER BY "saleId", "method"
  `;

  if (groups.length === 0) {
    console.log("✅ Sin duplicados — tabla limpia.");
    return;
  }

  console.log(`Encontrados ${groups.length} grupos duplicados. Clasificando...\n`);

  const classified: Classified[] = [];
  for (const g of groups) {
    const sale = await prisma.sale.findUnique({
      where: { id: g.saleId },
      select: { status: true },
    });
    const txs = await prisma.cashTransaction.findMany({
      where: { saleId: g.saleId, method: g.method as never, type: "PAYMENT_IN" },
      select: { collectionStatus: true },
    });
    const statuses = txs.map((t) => t.collectionStatus);

    let category: Classified["category"];
    if (sale?.status === "LAYAWAY") {
      category = "LAYAWAY";
    } else if (
      g.method === "ATRATO" &&
      statuses.some((s) => s === "REJECTED" || s === "DEFAULTED" || s === "CANCELLED") &&
      statuses.some((s) => s === "COLLECTED" || s === "PENDING")
    ) {
      category = "ATRATO_RETRY";
    } else {
      category = "RESIDUAL_BUG";
    }

    classified.push({
      saleId: g.saleId,
      method: g.method,
      cnt: g.cnt,
      saleStatus: sale?.status ?? "<missing-sale>",
      statuses,
      category,
    });
  }

  const layaway = classified.filter((c) => c.category === "LAYAWAY");
  const atrato = classified.filter((c) => c.category === "ATRATO_RETRY");
  const residual = classified.filter((c) => c.category === "RESIDUAL_BUG");

  console.log(`Resumen:`);
  console.log(`  LAYAWAY (legítimo, abonos):     ${layaway.length}`);
  console.log(`  ATRATO retry (legítimo):        ${atrato.length}`);
  console.log(`  RESIDUAL (bug latente):         ${residual.length}`);

  if (residual.length > 0) {
    console.log(`\n⚠ Residuales detectados — el Zod refinement de E.1 bloqueará prospectivamente:`);
    for (const r of residual.slice(0, 20)) {
      console.log(
        `  saleId=${r.saleId} method=${r.method} cnt=${r.cnt} status=${r.saleStatus} statuses=[${r.statuses.join(",")}]`,
      );
    }
    if (residual.length > 20) {
      console.log(`  ... +${residual.length - 20} más`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
