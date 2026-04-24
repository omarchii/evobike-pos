import "server-only";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "admin_branch_id";

/**
 * Fragmento `where` de Prisma para el filtro por sucursal. Vista Global
 * (`viewBranchId === null`) retorna `{}` — sin filtro. Se puede esparcir a
 * nivel raíz (`where: { ...branchWhere(id), status: ... }`) o anidar en
 * relaciones (`where: { user: branchWhere(id) }`).
 *
 * Regla: toda query con filtro de sucursal pasa por este helper. Nunca
 * `branchId:` suelto.
 *
 * Existe un homónimo legacy en `@/lib/reportes/branch-scope` con otra
 * signature (role-based). A consolidar.
 */
export function branchWhere(viewBranchId: string | null): { branchId?: string } {
    return viewBranchId ? { branchId: viewBranchId } : {};
}

/**
 * Resuelve el filtro de sucursal efectivo para la request actual. SOLO para
 * lectura de datos — nunca usar para determinar el branchId de una escritura
 * (los writes toman branchId del body validado, no del filtro de vista).
 *
 * Reglas:
 * - No-admin (SELLER/MANAGER/TECHNICIAN): forzado a `user.branchId` de la
 *   sesión. Ignora `?branch=` y cookie.
 * - ADMIN: precedencia `?branch=` (efímero) > cookie `admin_branch_id` >
 *   `null` (Global). El branchId candidato se valida contra BD; si no existe,
 *   cae a Global en lugar de filtrar por un id inexistente.
 *
 * Nota: el `?branch=` es una view-hint de un solo uso — no toca la cookie.
 * Compartir una URL con `?branch=X` muestra esos datos al destinatario sin
 * alterar su filtro persistente.
 */
export async function getViewBranchId(
    searchParams?: Record<string, string | string[] | undefined>,
): Promise<string | null> {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string; branchId?: string | null } | undefined;
    if (!user) return null;

    if (user.role !== "ADMIN") {
        return user.branchId ? user.branchId : null;
    }

    const raw = searchParams?.branch;
    const urlBranch = typeof raw === "string" && raw.length > 0 ? raw : null;

    let candidate: string | null = urlBranch;
    if (!candidate) {
        const jar = await cookies();
        const cookieRaw = jar.get(COOKIE_NAME)?.value;
        if (cookieRaw) {
            try {
                const parsed = JSON.parse(cookieRaw) as { id?: string };
                candidate = parsed.id ?? null;
            } catch {
                candidate = null;
            }
        }
    }

    if (!candidate) return null;

    const found = await prisma.branch.findUnique({
        where: { id: candidate },
        select: { id: true },
    });
    return found ? found.id : null;
}
