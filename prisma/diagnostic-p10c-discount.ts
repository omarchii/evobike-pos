import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const [
    totalSales,
    salesWithGlobalDiscount,
    totalItems,
    itemsWithLineDiscount,
    sampleGlobal,
    sampleLine,
  ] = await Promise.all([
    prisma.sale.count({ where: { status: "COMPLETED" } }),
    prisma.sale.count({ where: { status: "COMPLETED", discount: { gt: 0 } } }),
    prisma.saleItem.count({ where: { sale: { status: "COMPLETED" } } }),
    prisma.saleItem.count({
      where: { sale: { status: "COMPLETED" }, discount: { gt: 0 } },
    }),
    prisma.sale.findMany({
      where: { status: "COMPLETED", discount: { gt: 0 } },
      take: 5,
      select: { folio: true, discount: true, subtotal: true, total: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.saleItem.findMany({
      where: { sale: { status: "COMPLETED" }, discount: { gt: 0 } },
      take: 5,
      select: {
        sale: { select: { folio: true } },
        price: true,
        quantity: true,
        discount: true,
      },
      orderBy: { sale: { createdAt: "desc" } },
    }),
  ]);

  console.log("=== P10-C diagnóstico de descuentos ===");
  console.log(`Ventas COMPLETED: ${totalSales}`);
  console.log(
    `  con Sale.discount > 0: ${salesWithGlobalDiscount} (${totalSales > 0 ? ((salesWithGlobalDiscount / totalSales) * 100).toFixed(1) : "0.0"}%)`,
  );
  console.log(`SaleItems totales: ${totalItems}`);
  console.log(
    `  con SaleItem.discount > 0: ${itemsWithLineDiscount} (${totalItems > 0 ? ((itemsWithLineDiscount / totalItems) * 100).toFixed(1) : "0.0"}%)`,
  );
  console.log("\nMuestra 5 ventas con descuento global:");
  console.table(
    sampleGlobal.map((s) => ({
      folio: s.folio,
      discount: Number(s.discount),
      subtotal: Number(s.subtotal),
      total: Number(s.total),
    })),
  );
  console.log("\nMuestra 5 líneas con descuento por línea:");
  console.table(
    sampleLine.map((i) => ({
      folio: i.sale.folio,
      price: Number(i.price),
      quantity: i.quantity,
      discount: Number(i.discount),
    })),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
