import { prisma } from "@/lib/prisma";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export class StockConflictError extends Error {
  constructor() {
    super("Conflicto de concurrencia en stock — reintentando");
    this.name = "StockConflictError";
  }
}

export async function adjustStock(
  tx: TxClient,
  stockId: string,
  delta: number,
  expectedVersion: number,
): Promise<void> {
  const result = await tx.stock.updateMany({
    where: { id: stockId, version: expectedVersion },
    data: { quantity: { increment: delta }, version: { increment: 1 } },
  });
  if (result.count === 0) throw new StockConflictError();
}

export async function upsertStockVariant(
  tx: TxClient,
  productVariantId: string,
  branchId: string,
  delta: number,
): Promise<void> {
  await tx.stock.upsert({
    where: { productVariantId_branchId: { productVariantId, branchId } },
    update: { quantity: { increment: delta }, version: { increment: 1 } },
    create: { productVariantId, branchId, quantity: delta },
  });
}

export async function upsertStockSimple(
  tx: TxClient,
  simpleProductId: string,
  branchId: string,
  delta: number,
): Promise<void> {
  await tx.stock.upsert({
    where: { simpleProductId_branchId: { simpleProductId, branchId } },
    update: { quantity: { increment: delta }, version: { increment: 1 } },
    create: { simpleProductId, branchId, quantity: delta },
  });
}

export async function withStockRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof StockConflictError && attempt < maxRetries) continue;
      throw e;
    }
  }
  throw new Error("unreachable");
}
