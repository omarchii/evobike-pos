import type { ReportRole } from "./reports-config";

export const PINNED_DEFAULTS_BY_ROLE: Record<ReportRole, string[]> = {
  ADMIN: ["ventas-e-ingresos", "estado-resultados", "stock-critico", "cuentas-por-pagar"],
  MANAGER: ["ventas-e-ingresos", "stock-critico", "tesoreria"],
  SELLER: ["clientes"],
  TECHNICIAN: [],
};

/**
 * Pinned efectivos: si el array en DB está vacío usa defaults del rol.
 * Máx 4 slugs (UI recorta si se pasa).
 */
export function getEffectivePinned(
  role: ReportRole,
  userPinned: string[],
): string[] {
  if (userPinned.length > 0) return userPinned.slice(0, 4);
  return PINNED_DEFAULTS_BY_ROLE[role].slice(0, 4);
}
