/**
 * Helper genérico de scoping por sucursal para reportes (P10).
 *
 * Retorna `{ branchId?: string }` — estructura que Prisma acepta
 * por duck-typing en cualquier `*WhereInput` que tenga un campo `branchId`.
 *
 * NO tipar el retorno como `Prisma.SaleWhereInput["branchId"]` porque
 * eso lo haría incompatible con los otros modelos (OperationalExpense,
 * PurchaseReceipt, InventoryMovement, Stock, CashRegisterSession, etc.).
 */

export interface BranchScopeInput {
  role: string;
  branchId: string | null;
}

/**
 * Calcula el filtro de sucursal adecuado según el rol del usuario
 * y el filtro opcional seleccionado en la UI.
 *
 * - ADMIN sin filtro    → `{}` (ve todo)
 * - ADMIN con filtro    → `{ branchId: filterBranchId }`
 * - No-ADMIN            → `{ branchId: session.branchId }` (o `__none__` si no tiene)
 */
export function branchWhere(
  session: BranchScopeInput,
  filterBranchId?: string,
): { branchId?: string } {
  if (session.role === "ADMIN" && filterBranchId) {
    return { branchId: filterBranchId };
  }
  if (session.role === "ADMIN") {
    return {};
  }
  if (!session.branchId) {
    // Usuario sin sucursal asignada → no debe ver ningún registro.
    return { branchId: "__none__" };
  }
  return { branchId: session.branchId };
}
