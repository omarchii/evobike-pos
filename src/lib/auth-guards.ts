import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import type { BranchedSessionUser, SessionUser } from "./auth-types";

/**
 * Resultado del guard para API routes — discriminated union con `ok`.
 *
 * Uso:
 * ```
 * const guard = requireBranchedUser(session);
 * if (!guard.ok) return guard.response;
 * const { user } = guard;
 * ```
 */
export type BranchedUserGuard =
    | { ok: true; user: BranchedSessionUser }
    | { ok: false; response: NextResponse };

/**
 * Para API routes — valida sesión + `branchId` no-null. Devuelve un
 * `BranchedSessionUser` narrowed o un `NextResponse` listo (401 sin sesión,
 * 400 sin sucursal). Usa shape `{ success: false, error }`.
 *
 * No usar en routes donde ADMIN puede operar sin sucursal (ver
 * `requireSessionUser` para ese caso).
 */
export function requireBranchedUser(session: Session | null): BranchedUserGuard {
    if (!session?.user) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 },
            ),
        };
    }
    const user = session.user as unknown as BranchedSessionUser;
    if (!user.branchId) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: "Usuario sin sucursal asignada" },
                { status: 400 },
            ),
        };
    }
    return { ok: true, user };
}

/**
 * Para Server Components — valida sesión + `branchId` no-null. En fallo
 * llama `redirect(redirectTo)` (el cual lanza, narrowing TS por `never`).
 * Retorna el `BranchedSessionUser` narrowed.
 */
export function requireBranchedUserOrRedirect(
    session: Session | null,
    redirectTo: string = "/login",
): BranchedSessionUser {
    if (!session?.user) redirect(redirectTo);
    const user = session.user as unknown as BranchedSessionUser;
    if (!user.branchId) redirect(redirectTo);
    return user;
}

/**
 * Resultado del guard relajado — sólo valida sesión, `branchId` puede ser null
 * (caso ADMIN sin sucursal asignada).
 */
export type SessionUserGuard =
    | { ok: true; user: SessionUser }
    | { ok: false; response: NextResponse };

/**
 * Para API routes donde ADMIN puede operar sin sucursal — valida solo que haya
 * sesión. El caller es responsable de manejar `user.branchId === null` según
 * su lógica (ej. `if (!isAdmin && !user.branchId) return 400`).
 */
export function requireSessionUser(session: Session | null): SessionUserGuard {
    if (!session?.user) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 },
            ),
        };
    }
    const user = session.user as unknown as SessionUser;
    return { ok: true, user };
}
