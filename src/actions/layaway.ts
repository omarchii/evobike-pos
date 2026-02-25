"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface LayawayPaymentInput {
    saleId: string;
    amount: number;
    method: "CASH" | "CARD" | "TRANSFER";
}

export async function registerLayawayPayment(input: LayawayPaymentInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const userId = (session.user as any).id;
        const branchId = (session.user as any).branchId;

        // Ensure there is an active cash session
        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: { userId, branchId, status: "OPEN" },
        });

        if (!activeSession) {
            return { success: false, error: "Caja cerrada. Abre la caja para procesar pagos." };
        }

        const sale = await prisma.sale.findUnique({
            where: { id: input.saleId },
            include: { payments: true }
        });

        if (!sale || sale.status !== "LAYAWAY") {
            return { success: false, error: "Apartado no encontrado o ya liquidado" };
        }

        // Calculate pending balance
        const totalPaid = sale.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const pendingBalance = Number(sale.total) - totalPaid;

        if (input.amount <= 0 || input.amount > pendingBalance) {
            return { success: false, error: "Monto de abono inválido" };
        }

        // Transaction to add payment and conditionally update status
        await prisma.$transaction(async (tx) => {
            // 1. Create the cash transaction
            await tx.cashTransaction.create({
                data: {
                    sessionId: activeSession.id,
                    saleId: sale.id,
                    type: "PAYMENT_IN",
                    method: input.method,
                    amount: input.amount
                }
            });

            // 2. Check if fully paid
            const newTotalPaid = totalPaid + input.amount;

            if (newTotalPaid >= Number(sale.total)) {
                await tx.sale.update({
                    where: { id: sale.id },
                    data: { status: "COMPLETED" }
                });
            }
        });

        revalidatePath("/layaways");
        revalidatePath("/point-of-sale");

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
