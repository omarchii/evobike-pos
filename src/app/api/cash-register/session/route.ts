import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type CashRegisterSession } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { getActiveSession } from "@/lib/cash-register";
import { getViewBranchId } from "@/lib/branch-filter";
import {
    AuthorizationConsumeError,
    consumeAuthorization,
} from "@/lib/authorizations";

type SerializedCashSession = Omit<
    CashRegisterSession,
    "openingAmt" | "closingAmt" | "diferencia"
> & {
    openingAmt: number;
    closingAmt: number | null;
    diferencia: number | null;
};

type CashSessionScope = "GLOBAL" | "BRANCH";

function serializeSession(s: CashRegisterSession): SerializedCashSession {
    return {
        ...s,
        openingAmt: Number(s.openingAmt),
        closingAmt: s.closingAmt ? Number(s.closingAmt) : null,
        diferencia: s.diferencia !== null && s.diferencia !== undefined ? Number(s.diferencia) : null,
    };
}

function errorFromUnknown(error: unknown, scope: string): NextResponse {
    console.error(`[cash-register/session ${scope}]`, error);

    if (error instanceof UserInactiveError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorizationConsumeError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            return NextResponse.json(
                { success: false, error: "Ya hay una caja abierta en esta sucursal." },
                { status: 409 },
            );
        }

        if (error.code === "P2003") {
            return NextResponse.json(
                { success: false, error: "Sesión obsoleta. Cierra sesión y vuelve a iniciar." },
                { status: 401 },
            );
        }
    }

    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
}

// GET /api/cash-register/session — sesión activa de la sucursal en vista
export async function GET(): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    // Lectura: respeta vista (admin Global → null → no hay sesión a mostrar).
    const branchId = await getViewBranchId();

    try {
        const activeSession = branchId ? await getActiveSession(branchId) : null;
        const scope: CashSessionScope = branchId ? "BRANCH" : "GLOBAL";
        return NextResponse.json({
            success: true,
            data: activeSession ? serializeSession(activeSession) : null,
            scope,
            requiresBranchSelection: scope === "GLOBAL",
        });
    } catch (error: unknown) {
        return errorFromUnknown(error, "GET");
    }
}

const openSchema = z.object({
    openingAmt: z.number().nonnegative(),
});

// POST /api/cash-register/session — abrir caja de la sucursal
export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = openSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);
        // Principio Fase 1: writes nunca infieren del filtro. branchId viene de la
        // sesión del cajero, no de la cookie. Admin sin sucursal no abre caja por
        // este endpoint — ese flujo remoto va por Autorizaciones (pendiente).
        const branchId = user.branchId;
        if (!branchId) {
            return NextResponse.json(
                { success: false, error: "No tenés una sucursal asignada. Pedí apertura remota por el flujo de autorizaciones." },
                { status: 403 },
            );
        }

        const existing = await getActiveSession(branchId);
        if (existing) {
            return NextResponse.json(
                { success: false, error: "Ya hay una caja abierta en esta sucursal." },
                { status: 409 },
            );
        }

        const newSession = await prisma.cashRegisterSession.create({
            data: {
                userId: user.id,
                branchId,
                openingAmt: parsed.data.openingAmt,
                status: "OPEN",
            },
        });

        return NextResponse.json({ success: true, data: serializeSession(newSession) });
    } catch (error: unknown) {
        return errorFromUnknown(error, "POST");
    }
}

// Fórmula canónica documentada en AGENTS.md §Caja:
//   expectedCash = openingAmt
//     + Σ(PAYMENT_IN method=CASH collected)
//     + Σ(CASH_DEPOSIT)
//     - Σ(EXPENSE_OUT method=CASH)
//     - Σ(WITHDRAWAL)
//     - Σ(REFUND_OUT method=CASH)

// NO es tolerancia contable — regla de negocio es "cero estricto". Este umbral
// solo absorbe ruido de redondeo Decimal(10,2) ↔ Number al sumar N transacciones
// (p.ej. 5000.000000000002 tras sumar floats). Un sub-centavo nunca existe en la
// caja física, así que debajo de 1e-2 es por definición ruido, no diferencia real.
const FLOATING_POINT_EPSILON = 0.01;

// Tolerancia del expectedAmt reportado por el cliente vs recalculado por el server.
// Absorbe la misma clase de ruido numérico en el camino inverso (server → cliente →
// server) para que el round-trip no falle espuriamente. Si excede, significa que
// llegaron transacciones concurrentes mientras el modal estaba abierto — 409 para
// forzar refresh, NO para aceptar diferencia silenciosa.
const EXPECTED_CLIENT_TOLERANCE = 0.5;

const closeSchema = z.object({
    closingAmt: z.number().nonnegative(),
    expectedAmt: z.number().nonnegative(),
    diferencia: z.number(), // puede ser negativa
    denominaciones: z.record(z.string(), z.number().int().nonnegative()).optional(),
    authorizationId: z.string().cuid().optional(),
});

// PATCH /api/cash-register/session — cerrar caja de la sucursal con denominaciones + diferencia
export async function PATCH(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = closeSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                error: parsed.error.issues[0]?.message ?? "Datos inválidos",
            },
            { status: 400 },
        );
    }

    try {
        const user = await requireActiveUser(session);
        // Principio Fase 1: branchId viene de la sesión del operador, nunca del
        // filtro. Cierre remoto de admin sin sucursal va por Autorizaciones.
        const branchId = user.branchId;
        if (!branchId) {
            return NextResponse.json(
                { success: false, error: "No tenés una sucursal asignada. Los cierres remotos van por el flujo de autorizaciones." },
                { status: 403 },
            );
        }

        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: { branchId, status: "OPEN" },
            include: { transactions: true },
        });

        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "No hay ninguna caja abierta en esta sucursal." },
                { status: 404 },
            );
        }

        // Recalcular expectedAmt server-side (no confiar en el cliente).
        const openingAmt = Number(activeSession.openingAmt);
        let salesCash = 0;
        let depositsCash = 0;
        let expensesCash = 0;
        let withdrawalsCash = 0;
        let refundsCash = 0;

        for (const tx of activeSession.transactions) {
            const amt = Number(tx.amount);
            if (tx.type === "PAYMENT_IN" && tx.method === "CASH" && tx.collectionStatus === "COLLECTED") {
                salesCash += amt;
            } else if (tx.type === "CASH_DEPOSIT") {
                depositsCash += amt;
            } else if (tx.type === "EXPENSE_OUT" && tx.method === "CASH") {
                expensesCash += amt;
            } else if (tx.type === "WITHDRAWAL") {
                withdrawalsCash += amt;
            } else if (tx.type === "REFUND_OUT" && tx.method === "CASH") {
                refundsCash += amt;
            }
        }

        const expectedAmtServer =
            openingAmt + salesCash + depositsCash - expensesCash - withdrawalsCash - refundsCash;

        if (Math.abs(expectedAmtServer - parsed.data.expectedAmt) > EXPECTED_CLIENT_TOLERANCE) {
            return NextResponse.json(
                {
                    success: false,
                    error: "El efectivo esperado cambió. Refresca la página e intenta de nuevo.",
                },
                { status: 409 },
            );
        }

        const diferenciaReal = parsed.data.closingAmt - expectedAmtServer;
        const hasDiferencia = Math.abs(diferenciaReal) > FLOATING_POINT_EPSILON;

        // Reglas de autorización.
        if (hasDiferencia && user.role === "SELLER" && !parsed.data.authorizationId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Cerrar con diferencia requiere autorización de gerente.",
                },
                { status: 400 },
            );
        }

        // authorizedById: quién aprobó la diferencia. Para MANAGER/ADMIN sin auth request, se
        // audita como auto-autorización (user.id). Para SELLER con authorizationId, se resuelve
        // durante consumeAuthorization (approvedBy de la request).
        const closed = await prisma.$transaction(async (tx) => {
            let authorizedById: string | null = null;

            if (hasDiferencia) {
                if (parsed.data.authorizationId) {
                    // Consume y lockea la autorización (setea cashSessionId, previene reuso).
                    await consumeAuthorization(tx, {
                        tipo: "CIERRE_DIFERENCIA",
                        authorizationId: parsed.data.authorizationId,
                        requestedBy: user.id,
                        cashSessionId: activeSession.id,
                    });
                    // Leer approvedBy de la autorización para auditar en CashRegisterSession.
                    const auth = await tx.authorizationRequest.findUnique({
                        where: { id: parsed.data.authorizationId },
                        select: { approvedBy: true },
                    });
                    authorizedById = auth?.approvedBy ?? null;
                } else if (user.role === "MANAGER" || user.role === "ADMIN") {
                    // Auto-autorización: queda en auditoría.
                    authorizedById = user.id;
                }
                // SELLER sin authorizationId ya fue bloqueado arriba.
            }

            const updated = await tx.cashRegisterSession.update({
                where: { id: activeSession.id },
                data: {
                    closedAt: new Date(),
                    closingAmt: parsed.data.closingAmt,
                    diferencia: diferenciaReal,
                    authorizedById,
                    status: "CLOSED",
                    denominationsJson: parsed.data.denominaciones ?? undefined,
                },
                include: {
                    authorizedBy: { select: { id: true, name: true } },
                },
            });

            return updated;
        });

        return NextResponse.json({
            success: true,
            data: {
                ...serializeSession(closed),
                authorizedBy: closed.authorizedBy
                    ? { id: closed.authorizedBy.id, name: closed.authorizedBy.name }
                    : null,
            },
        });
    } catch (error: unknown) {
        return errorFromUnknown(error, "PATCH");
    }
}
