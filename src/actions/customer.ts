"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

interface AddBalanceInput {
    customerId: string;
    amount: number;
    method: "CASH" | "CARD" | "TRANSFER";
}

export async function addCustomerBalance(input: AddBalanceInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as SessionUser;

        // Ensure there is an active cash session
        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: { userId, branchId, status: "OPEN" },
        });

        if (!activeSession) {
            return { success: false, error: "Caja cerrada. Debes abrir tu turno para recibir dinero." };
        }

        if (input.amount <= 0) {
            return { success: false, error: "Monto inválido" };
        }

        await prisma.$transaction(async (tx) => {
            // 1. Create a cash transaction linked to the shift
            await tx.cashTransaction.create({
                data: {
                    sessionId: activeSession.id,
                    type: "PAYMENT_IN", // Treated as income because money physically entered the drawer
                    method: input.method,
                    amount: input.amount
                }
            });

            // 2. Add balance to the customer
            await tx.customer.update({
                where: { id: input.customerId },
                data: {
                    balance: { increment: input.amount }
                }
            });
        });

        revalidatePath("/customers");
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

interface CreateCustomerInput {
    name: string;
    phone?: string;
    email?: string;
}

export async function createCustomer(input: CreateCustomerInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        if (!input.name) {
            return { success: false, error: "El nombre es obligatorio" };
        }

        const newCustomer = await prisma.customer.create({
            data: {
                name: input.name,
                phone: input.phone || null,
                email: input.email || null,
                creditLimit: 0,
                balance: 0,
            }
        });

        revalidatePath("/customers");
        revalidatePath("/point-of-sale");

        return { success: true, customer: newCustomer };
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = error.meta?.target;
            if (Array.isArray(target) && target.includes("phone")) {
                return { success: false, error: "El teléfono ya está registrado" };
            }
        }
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
