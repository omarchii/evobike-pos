import "server-only";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "admin_branch_id";

type BranchScopedUser = {
    role?: string;
    branchId?: string | null;
};

type BranchWriteAccessResult =
    | { success: true; branchId: string }
    | { success: false; status: 400 | 403 | 404; error: string };

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

/**
 * Resuelve una sucursal operativa para escrituras que crean recursos nuevos.
 * El branchId debe venir como intencion explicita del cliente/server page; no
 * se infiere de cookies ni de `?branch=` dentro del Route Handler.
 */
export async function resolveWriteBranchId(
    user: BranchScopedUser,
    requestedBranchId: string | null | undefined,
): Promise<BranchWriteAccessResult> {
    if (user.role !== "ADMIN") {
        if (!user.branchId) {
            return {
                success: false,
                status: 403,
                error: "No tienes una sucursal asignada.",
            };
        }
        if (requestedBranchId && requestedBranchId !== user.branchId) {
            return {
                success: false,
                status: 403,
                error: "Sin acceso a esta sucursal",
            };
        }
        return { success: true, branchId: user.branchId };
    }

    if (!requestedBranchId) {
        return {
            success: false,
            status: 400,
            error: "Selecciona una sucursal para operar",
        };
    }

    const found = await prisma.branch.findUnique({
        where: { id: requestedBranchId },
        select: { id: true },
    });
    if (!found) {
        return {
            success: false,
            status: 404,
            error: "Sucursal no encontrada",
        };
    }

    return { success: true, branchId: found.id };
}

/**
 * Valida escrituras sobre recursos existentes, donde la verdad de sucursal
 * viene del recurso en BD. Si el cliente manda branchId, se verifica que
 * coincida para detectar intenciones inconsistentes.
 */
export function validateBranchWriteAccess(
    user: BranchScopedUser,
    resourceBranchId: string,
    requestedBranchId?: string | null,
): BranchWriteAccessResult {
    if (requestedBranchId && requestedBranchId !== resourceBranchId) {
        return {
            success: false,
            status: 403,
            error: "La sucursal enviada no coincide con la orden.",
        };
    }

    if (user.role !== "ADMIN" && user.branchId !== resourceBranchId) {
        return {
            success: false,
            status: 403,
            error: "Sin acceso a esta orden",
        };
    }

    return { success: true, branchId: resourceBranchId };
}
