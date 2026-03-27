import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

interface DeliverRequestBody {
    serviceOrderId: string;
    paymentMethod: PaymentMethod;
}

interface SessionUser {
    id: string;
    branchId: string;
}

// POST /api/workshop/deliver
// Cobra el total de una orden de taller y la marca como DELIVERED.
// Requiere sesión de caja activa (OPEN) para el usuario y sucursal.
export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { id: userId, branchId } = session.user as unknown as SessionUser;

        if (!branchId) {
            return NextResponse.json(
                { success: false, error: "Empleado sin sucursal asignada" },
                { status: 400 }
            );
        }

        const body = (await request.json()) as DeliverRequestBody;
        const { serviceOrderId, paymentMethod } = body;

        if (!serviceOrderId || !paymentMethod) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        const validMethods: PaymentMethod[] = ["CASH", "CARD", "TRANSFER"];
        if (!validMethods.includes(paymentMethod)) {
            return NextResponse.json({ success: false, error: "Método de pago no válido" }, { status: 400 });
        }

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

        // Verificar sesión de caja activa
        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: { userId, branchId, status: "OPEN" }
        });

        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "Debes tener una sesión de caja abierta para cobrar y entregar" },
                { status: 400 }
            );
        }

        // Transacción ACID: registrar cobro + cambiar status
        await prisma.$transaction(async (tx) => {
            if (Number(order.total) > 0) {
                await tx.cashTransaction.create({
                    data: {
                        sessionId: activeSession.id,
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
        const message = error instanceof Error ? error.message : "Error al procesar la entrega";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
