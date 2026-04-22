import { getAdminActiveBranch } from "@/lib/actions/branch";
import type { SessionUser } from "@/lib/auth-types";

// Re-export para consumers que ya importan desde reportes/branch-scope.
// `branchWhere` conserva su semántica original: ADMIN sin filtro devuelve {}
// (vista global) — correcto SOLO para /reportes/* y /configuracion/*.
export { branchWhere, type BranchScopeInput } from "./reportes/branch-scope";

/**
 * Scoping por sucursal para módulos operativos (/workshop, /point-of-sale,
 * /inventario, /tesoreria, /autorizaciones). A diferencia de `branchWhere`,
 * ADMIN honra la cookie `admin_branch_id` del topbar; si no hay cookie,
 * fallback a `session.branchId`. NUNCA devuelve {} — no hay vista global
 * cross-branch en operativos (ROADMAP §1204, política 2026-04-22).
 */
export async function operationalBranchWhere(
  session: { user: SessionUser },
): Promise<{ branchId: string }> {
  const userBranchId = session.user.branchId;
  if (session.user.role === "ADMIN") {
    const saved = await getAdminActiveBranch();
    return { branchId: saved?.id ?? userBranchId ?? "__none__" };
  }
  return { branchId: userBranchId ?? "__none__" };
}

/** Desempaqueta `operationalBranchWhere` para APIs que necesitan el string
 *  directo (por ejemplo al asignar `branchId` a un recurso nuevo). */
export async function resolveOperationalBranchId(
  session: { user: SessionUser },
): Promise<string> {
  const { branchId } = await operationalBranchWhere(session);
  return branchId;
}
