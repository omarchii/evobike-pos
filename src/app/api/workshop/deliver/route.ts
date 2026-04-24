import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
    getActiveSession,
    assertSessionFreshOrThrow,
    OrphanedCashSessionError,
} from "@/lib/cash-register";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

// Atrato no aplica para cobros de taller (cobro directo, sin financiera)
type DeliveryPaymentMethod = "CASH" | "CARD" | "TRANSFER";

interface DeliverRequestBody {
    serviceOrderId: string;
    paymentMethod: DeliveryPaymentMethod;
}

// POST /api/workshop/deliver
// Cobra el total de una orden de taller y la marca como DELIVERED.
// Requiere caja abierta en la sucursal efectiva (JWT para MANAGER/TECHNICIAN,
// filtro del topbar para ADMIN — ver `getViewBranchId`).
export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as unknown as SessionUser;
        const userId = user.id;
        const branchId = await getViewBranchId();

        if (!branchId) {
            return NextResponse.json(
                { success: false, error: "Selecciona una sucursal para operar" },
                { status: 400 }
            );
        }

        const body = (await request.json()) as DeliverRequestBody;
        const { serviceOrderId, paymentMethod } = body;

        if (!serviceOrderId || !paymentMethod) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        const validMethods: DeliveryPaymentMethod[] = ["CASH", "CARD", "TRANSFER"];
        if (!validMethods.includes(paymentMethod)) {
            return NextResponse.json({ success: false, error: "Método de pago no válido" }, { status: 400 });
        }

        await requireActiveUser(session);

        const order = await prisma.serviceOrder.findUnique({
            where: { id: serviceOrderId }
        });

        if (!order) {
            return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
        }
        if (order.status !== "COMPLETED") {
            return NextResponse.json(
                { success: false, error: "Solo se pueden entregar órdenes con estatus COMPLETADO" },
                { status: 400 }
            );
        }
        if (order.branchId !== branchId) {
            return NextResponse.json(
                { success: false, error: "No autorizado para esta orden" },
                { status: 403 }
            );
        }

        const activeSession = await getActiveSession(branchId);
        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "Debes tener la caja abierta para cobrar y entregar" },
                { status: 409 }
            );
        }
        assertSessionFreshOrThrow(activeSession);

        // Transacción ACID: registrar cobro + cambiar status
        await prisma.$transaction(async (tx) => {
            if (Number(order.total) > 0) {
                await tx.cashTransaction.create({
                    data: {
                        sessionId: activeSession.id,
                        userId,
                        type: "PAYMENT_IN",
                        method: paymentMethod,
                        amount: order.total
                    }
                });
            }

            await tx.serviceOrder.update({
                where: { id: serviceOrderId },
                data: { status: "DELIVERED" }
            });
        });

        revalidatePath("/workshop");
        revalidatePath(`/workshop/${serviceOrderId}`);

        return NextResponse.json({ success: true, newStatus: "DELIVERED" });
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
        console.error("[api/workshop/deliver POST]", error);
        const message = error instanceof Error ? error.message : "Error al procesar la entrega";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
