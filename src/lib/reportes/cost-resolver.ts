/**
 * Contrato y tipos para la resolución de costos en reportes de rentabilidad.
 *
 * La implementación real de la query queda pendiente para Lote 5 (P10-C + P10-D).
 */

/** Fuente del costo unitario utilizado. */
export type CostSource = "historical" | "catalog" | "unknown";

/** Resultado de la resolución de costo para una línea de venta. */
export interface ResolvedCost {
  unitCost: number;
  source: CostSource;
}

/** Parámetros de entrada para el resolver. */
export interface CostResolverInput {
  productVariantId?: string | null;
  simpleProductId?: string | null;
  branchId: string;
}

// export async function resolveCost(input: CostResolverInput): Promise<ResolvedCost>
//
// Implementación pendiente para Lote 5 (P10-C + P10-D).
//
// Lógica prevista:
//   1. Si productVariantId: buscar el último InventoryMovement(PURCHASE_RECEIPT)
//      de esa variante en la sucursal → usar `precioUnitarioPagado` (fuente: "historical").
//   2. Fallback: ProductVariant.costo (fuente: "catalog").
//   3. Si simpleProductId: buscar el último InventoryMovement(PURCHASE_RECEIPT)
//      de ese simpleProduct → usar `precioUnitarioPagado` (fuente: "historical").
//   4. Fallback: SimpleProduct.precioMayorista (fuente: "catalog").
//   5. Si ninguno: { unitCost: 0, source: "unknown" }.
