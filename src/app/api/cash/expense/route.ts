import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CashExpenseCategory, Prisma, type CashTransaction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
    assertSessionFreshOrThrow,
    getActiveSession,
    OrphanedCashSessionError,
} from "@/lib/cash-register";

const SELLER_EXPENSE_LIMIT = 500;

const expenseSchema = z.object({
    amount: z.coerce.number().positive(),
    method: z.literal("CASH"),
    category: z.nativeEnum(CashExpenseCategory),
    beneficiary: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres."),
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
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json({ success: false, error: first }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role === "SELLER" && parsed.data.amount > SELLER_EXPENSE_LIMIT) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Requiere autorización de gerente (pendiente de implementación en fase P5).",
                },
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
                userId: user.id,
                type: "EXPENSE_OUT",
                method: "CASH",
                amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
                beneficiary: parsed.data.beneficiary?.trim() ?? null,
                notes: parsed.data.notes.trim(),
                collectionStatus: "COLLECTED",
                collectedAt: now,
                expenseCategory: parsed.data.category,
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
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
            return NextResponse.json(
                { success: false, error: "Sesión obsoleta. Cierra sesión y vuelve a iniciar." },
                { status: 401 },
            );
        }
        console.error("[api/cash/expense POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
