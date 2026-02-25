"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface ReceiptInput {
    items: {
        productId: string;
        quantity: number;
        cost: number;
    }[];
    reference: string;
}

export async function receiveInventoryAction(input: ReceiptInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const userId = (session.user as any).id;
        const branchId = (session.user as any).branchId;

        if (!input.items || input.items.length === 0) {
            return { success: false, error: "No hay productos en esta recepción" };
        }

        // We use a transaction to guarantee all stocks update + kardex log in one go
        await prisma.$transaction(async (tx) => {
            for (const item of input.items) {
                if (item.quantity <= 0) continue;

                // 1. Update or create stock for this specific branch
                await tx.stock.upsert({
                    where: {
                        productId_branchId: {
                            productId: item.productId,
                            branchId: branchId
                        }
                    },
                    update: {
                        quantity: { increment: item.quantity }
                    },
                    create: {
                        productId: item.productId,
                        branchId: branchId,
                        quantity: item.quantity
                    }
                });

                // 2. Optionally update the "Cost" price on the product catalog if they entered a new purchase cost
                // We're leaving it simple here and overwriting the global cost
                await tx.product.update({
                    where: { id: item.productId },
                    data: { cost: item.cost }
                });

                // 3. Register immutable Inventory Movement logging the receipt
                await tx.inventoryMovement.create({
                    data: {
                        productId: item.productId,
                        branchId: branchId,
                        userId: userId,
                        quantity: item.quantity,
                        type: "PURCHASE_RECEIPT",
                        referenceId: input.reference || "RECEIPT_BATCH",
                    }
                });
            }
        });

        // Revalidate UI paths so tables update metrics
        revalidatePath("/inventory");
        revalidatePath("/inventory/receipts");

        return { success: true };
    } catch (error: any) {
        console.error("Error receiving inventory:", error);
        return { success: false, error: error.message || "No se pudo registrar la mercancía" };
    }
}
