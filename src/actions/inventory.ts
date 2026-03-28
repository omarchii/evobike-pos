"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface SessionUser {
    id: string;
    branchId: string;
}

interface ReceiptInput {
    items: {
        productVariantId: string;
        quantity: number;
        cost: number;
    }[];
    reference: string;
}

export async function receiveInventoryAction(input: ReceiptInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as unknown as SessionUser;

        if (!input.items || input.items.length === 0) {
            return { success: false, error: "No hay productos en esta recepción" };
        }

        await prisma.$transaction(async (tx) => {
            for (const item of input.items) {
                if (item.quantity <= 0) continue;

                await tx.stock.upsert({
                    where: {
                        productVariantId_branchId: {
                            productVariantId: item.productVariantId,
                            branchId: branchId
                        }
                    },
                    update: {
                        quantity: { increment: item.quantity }
                    },
                    create: {
                        productVariantId: item.productVariantId,
                        branchId: branchId,
                        quantity: item.quantity
                    }
                });

                await tx.productVariant.update({
                    where: { id: item.productVariantId },
                    data: { costo: item.cost }
                });

                await tx.inventoryMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        branchId: branchId,
                        userId: userId,
                        quantity: item.quantity,
                        type: "PURCHASE_RECEIPT",
                        referenceId: input.reference || "RECEIPT_BATCH",
                    }
                });
            }
        });

        revalidatePath("/inventory");
        revalidatePath("/inventory/receipts");

        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la mercancía";
        return { success: false, error: message };
    }
}
