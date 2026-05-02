import { prisma } from "@/lib/prisma";

export type CostSource = "RECEIPT" | "CATALOG" | "NONE";

export type ResolvedCost = {
  cost: number;
  source: CostSource;
  currency: "MXN";
};

/**
 * Resuelve el costo unitario actual (sin IVA) para un lote de productos.
 *
 * Prioridad:
 *   1. Último InventoryMovement(PURCHASE_RECEIPT).precioUnitarioPagado — global (sin filtro de sucursal).
 *   2. Fallback a ProductVariant.costo / SimpleProduct.costoInterno del catálogo.
 *   3. Si ninguno existe → { cost: 0, source: "NONE" }.
 *
 * Keys del Map: "v:{variantId}" para variants, "s:{simpleId}" para simples.
 */
export async function resolveCostsBatch(
  variantIds: string[],
  simpleIds: string[],
): Promise<Map<string, ResolvedCost>> {
  const costMap = new Map<string, ResolvedCost>();

  const hasVariants = variantIds.length > 0;
  const hasSimples = simpleIds.length > 0;

  if (!hasVariants && !hasSimples) return costMap;

  // ── Paso 1: último PURCHASE_RECEIPT por producto ──────────────────────────
  // Traer todos los movimientos relevantes ordenados desc; tomar la primera
  // aparición por key (= más reciente). Más simple que DISTINCT ON con dos
  // columnas polimórficas.
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      type: "PURCHASE_RECEIPT",
      precioUnitarioPagado: { not: null },
      OR: [
        ...(hasVariants ? [{ productVariantId: { in: variantIds } }] : []),
        ...(hasSimples ? [{ simpleProductId: { in: simpleIds } }] : []),
      ],
    },
    select: {
      productVariantId: true,
      simpleProductId: true,
      precioUnitarioPagado: true,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const m of movements) {
    const key = m.productVariantId
      ? `v:${m.productVariantId}`
      : m.simpleProductId
        ? `s:${m.simpleProductId}`
        : null;
    if (!key) continue; // invariante violada por el caller
    if (!costMap.has(key)) {
      costMap.set(key, {
        cost: Number(m.precioUnitarioPagado),
        source: "RECEIPT",
        currency: "MXN",
      });
    }
  }

  // ── Paso 2: fallback al catálogo para IDs sin entrada ────────────────────
  const missingVariants = variantIds.filter((id) => !costMap.has(`v:${id}`));
  const missingSimples = simpleIds.filter((id) => !costMap.has(`s:${id}`));

  const [variants, simples] = await Promise.all([
    missingVariants.length > 0
      ? prisma.productVariant.findMany({
          where: { id: { in: missingVariants } },
          select: { id: true, costo: true },
        })
      : Promise.resolve([] as { id: string; costo: { toNumber(): number } }[]),
    missingSimples.length > 0
      ? prisma.simpleProduct.findMany({
          where: { id: { in: missingSimples } },
          select: { id: true, costoInterno: true },
        })
      : Promise.resolve(
          [] as { id: string; costoInterno: { toNumber(): number } }[],
        ),
  ]);

  for (const v of variants) {
    costMap.set(`v:${v.id}`, {
      cost: Number(v.costo),
      source: "CATALOG",
      currency: "MXN",
    });
  }
  for (const s of simples) {
    costMap.set(`s:${s.id}`, {
      cost: Number(s.costoInterno),
      source: "CATALOG",
      currency: "MXN",
    });
  }

  // ── Paso 3: IDs aún sin entrada → NONE ───────────────────────────────────
  for (const id of variantIds) {
    if (!costMap.has(`v:${id}`)) {
      costMap.set(`v:${id}`, { cost: 0, source: "NONE", currency: "MXN" });
    }
  }
  for (const id of simpleIds) {
    if (!costMap.has(`s:${id}`)) {
      costMap.set(`s:${id}`, { cost: 0, source: "NONE", currency: "MXN" });
    }
  }

  return costMap;
}
