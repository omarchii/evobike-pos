import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { type CashTransaction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";

type SerializedCashTransaction = Omit<CashTransaction, "amount"> & { amount: number };

function serialize(tx: CashTransaction): SerializedCashTransaction {
    return { ...tx, amount: Number(tx.amount) };
}

// PATCH /api/cash/transactions/[id]/collect
// Marca un PAYMENT_IN pendiente como cobrado. No cambia el method.
// Disponible para todos los roles; la transacción debe pertenecer a la caja
// abierta de la sucursal del usuario.
export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const user = await requireActiveUser(session);

        const existing = await prisma.cashTransaction.findUnique({
            where: { id },
            include: { session: { select: { branchId: true, status: true } } },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Transacción no encontrada." },
                { status: 404 },
            );
        }

        if (existing.session.branchId !== user.branchId) {
            return NextResponse.json(
                { success: false, error: "La transacción pertenece a otra sucursal." },
                { status: 403 },
            );
        }

        if (existing.session.status !== "OPEN") {
            return NextResponse.json(
                { success: false, error: "La caja de esta transacción ya está cerrada." },
                { status: 409 },
            );
        }

        if (existing.collectionStatus !== "PENDING") {
            return NextResponse.json(
                { success: false, error: "La transacción ya estaba cobrada." },
                { status: 409 },
            );
        }

        const updated = await prisma.cashTransaction.update({
            where: { id },
            data: {
                collectionStatus: "COLLECTED",
                collectedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, data: serialize(updated) });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }
        console.error("[api/cash/transactions/[id]/collect PATCH]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
