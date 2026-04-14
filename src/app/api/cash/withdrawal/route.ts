import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma, type CashTransaction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
    assertSessionFreshOrThrow,
    getActiveSession,
    OrphanedCashSessionError,
} from "@/lib/cash-register";

const withdrawalSchema = z.object({
    amount: z.number().positive(),
    reference: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres."),
});

type SerializedCashTransaction = Omit<CashTransaction, "amount"> & { amount: number };

function serialize(tx: CashTransaction): SerializedCashTransaction {
    return { ...tx, amount: Number(tx.amount) };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = withdrawalSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json({ success: false, error: first }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, error: "Solo gerentes o administradores pueden registrar retiros." },
                { status: 403 },
            );
        }

        const activeSession = await getActiveSession(user.branchId);
        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "No hay ninguna caja abierta en esta sucursal." },
                { status: 409 },
            );
        }
        assertSessionFreshOrThrow(activeSession);

        const now = new Date();
        const tx = await prisma.cashTransaction.create({
            data: {
                sessionId: activeSession.id,
                type: "WITHDRAWAL",
                method: "CASH",
                amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
                reference: parsed.data.reference.trim(),
                collectionStatus: "COLLECTED",
                collectedAt: now,
            },
        });

        return NextResponse.json({ success: true, data: serialize(tx) });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }
        if (error instanceof OrphanedCashSessionError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones.",
                },
                { status: 409 },
            );
        }
        console.error("[api/cash/withdrawal POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
