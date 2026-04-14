import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export class UserInactiveError extends Error {
    constructor(message: string = "USER_INACTIVE") {
        super(message);
        this.name = "UserInactiveError";
    }
}

interface AuthedSessionUser {
    id: string;
    branchId: string;
    role: string;
}

export function getAuthedUser(session: Session | null): AuthedSessionUser | null {
    if (!session?.user) return null;
    const u = session.user as unknown as Partial<AuthedSessionUser>;
    if (!u.id || !u.branchId || !u.role) return null;
    return { id: u.id, branchId: u.branchId, role: u.role };
}

export async function requireActiveUser(session: Session | null): Promise<AuthedSessionUser> {
    const user = getAuthedUser(session);
    if (!user) {
        throw new UserInactiveError("No autenticado");
    }

    const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, isActive: true },
    });

    if (!row) {
        throw new UserInactiveError("Usuario no encontrado. Inicia sesión de nuevo.");
    }
    if (row.isActive === false) {
        throw new UserInactiveError("Tu cuenta fue desactivada. Contacta al administrador.");
    }

    return user;
}
