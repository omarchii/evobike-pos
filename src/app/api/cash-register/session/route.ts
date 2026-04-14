import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type CashRegisterSession } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { getActiveSession } from "@/lib/cash-register";

type SerializedCashSession = Omit<CashRegisterSession, "openingAmt" | "closingAmt"> & {
    openingAmt: number;
    closingAmt: number | null;
};

function serializeSession(s: CashRegisterSession): SerializedCashSession {
    return {
        ...s,
        openingAmt: Number(s.openingAmt),
        closingAmt: s.closingAmt ? Number(s.closingAmt) : null,
    };
}

function errorFromUnknown(error: unknown, scope: string): NextResponse {
    console.error(`[cash-register/session ${scope}]`, error);

    if (error instanceof UserInactiveError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return NextResponse.json(
            { success: false, error: "Sesión obsoleta. Cierra sesión y vuelve a iniciar." },
            { status: 401 },
        );
    }

    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
}

// GET /api/cash-register/session — sesión activa de la sucursal
export async function GET(): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const branchId = (session.user as unknown as { branchId: string }).branchId;

    try {
        const activeSession = await getActiveSession(branchId);
        return NextResponse.json({
            success: true,
            data: activeSession ? serializeSession(activeSession) : null,
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

        const existing = await getActiveSession(user.branchId);
        if (existing) {
            return NextResponse.json(
                { success: false, error: "Ya hay una caja abierta en esta sucursal." },
                { status: 409 },
            );
        }

        const newSession = await prisma.cashRegisterSession.create({
            data: {
                userId: user.id,
                branchId: user.branchId,
                openingAmt: parsed.data.openingAmt,
                status: "OPEN",
            },
        });

        return NextResponse.json({ success: true, data: serializeSession(newSession) });
    } catch (error: unknown) {
        return errorFromUnknown(error, "POST");
    }
}

const closeSchema = z.object({
    closingAmt: z.number().nonnegative(),
});

// PATCH /api/cash-register/session — cerrar caja de la sucursal
export async function PATCH(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = closeSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);

        const activeSession = await getActiveSession(user.branchId);
        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "No hay ninguna caja abierta en esta sucursal." },
                { status: 404 },
            );
        }

        const closed = await prisma.cashRegisterSession.update({
            where: { id: activeSession.id },
            data: {
                closedAt: new Date(),
                closingAmt: parsed.data.closingAmt,
                status: "CLOSED",
            },
        });

        return NextResponse.json({ success: true, data: serializeSession(closed) });
    } catch (error: unknown) {
        return errorFromUnknown(error, "PATCH");
    }
}
