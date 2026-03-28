"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface SaleInput {
    items: { modeloConfiguracionId: string; quantity: number; price: number; name: string; isSerialized?: boolean; serialNumber?: string }[];
    total: number;
    paymentMethod: "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE";
    isLayaway?: boolean;
    customerId?: string;
    downPayment?: number;
}

export async function processSaleAction(input: SaleInput) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return { success: false, error: "No autorizado" };
        }

        const userId = (session.user as any).id;
        const branchId = (session.user as any).branchId;

        if (!branchId) {
            return { success: false, error: "Usuario sin sucursal asignada" };
        }

        // -- VERY IMPORTANT: Require open Cash Session --
        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: {
                userId,
                branchId,
                status: "OPEN",
            },
        });

        if (!activeSession) {
            return { success: false, error: "Debes abrir caja antes de poder realizar ventas." };
        }

        if (!input.items || input.items.length === 0) {
            return { success: false, error: "El carrito está vacío" };
        }

        if (input.isLayaway) {
            if (!input.customerId) return { success: false, error: "Un apartado requiere asignar un cliente" };
            if (input.downPayment === undefined || input.downPayment < 0) return { success: false, error: "Monto de abono inicial no válido" };
        }

        // 1. Transaction to guarantee ACID properties: Sale creation + Stock reduction + Cash register movement
        const result = await prisma.$transaction(async (tx) => {

            // Pre-flight check: If paying with CREDIT_BALANCE, verify customer has enough funds
            if (input.paymentMethod === "CREDIT_BALANCE") {
                if (!input.customerId) {
                    throw new Error("Se requiere un cliente seleccionado para pagar con Saldo a Favor");
                }
                const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
                const paymentAmount = input.isLayaway ? (input.downPayment || 0) : input.total;

                if (!customer || Number(customer.balance) < paymentAmount) {
                    throw new Error(`Saldo insuficiente. El cliente tiene $${customer?.balance || 0} a favor.`);
                }

                // Deduct balance
                await tx.customer.update({
                    where: { id: input.customerId },
                    data: { balance: { decrement: paymentAmount } }
                });
            }

            // A. Verify and decrease stock for each item
            for (const item of input.items) {

                // Find existing stock
                const stock = await tx.stock.findUnique({
                    where: {
                        modeloConfiguracionId_branchId: {
                            modeloConfiguracionId: item.modeloConfiguracionId,
                            branchId: branchId
                        }
                    }
                });

                // If product is not serialized, strict stock check. (Serialized usually implies we check specific serial numbers, but for this abstraction we do basic count)
                if (!stock || stock.quantity < item.quantity) {
                    throw new Error(`Stock insuficiente para el producto: ${item.name}`);
                }

                // Deduct stock
                await tx.stock.update({
                    where: { id: stock.id },
                    data: {
                        quantity: {
                            decrement: item.quantity
                        }
                    }
                });

                // Check serialized equipment
                if (item.isSerialized && item.serialNumber) {
                    if (!input.customerId) {
                        throw new Error(`El producto ${item.name} requiere un número de serie, y DEBES seleccionar o crear un cliente a quién asignárselo.`);
                    }

                    // Validar unicidad del número de serie dentro de la sucursal
                    const existingBike = await tx.customerBike.findFirst({
                        where: { serialNumber: item.serialNumber, branchId }
                    });
                    if (existingBike) {
                        throw new Error(`Número de serie ya registrado en esta sucursal: ${item.serialNumber}`);
                    }

                    await tx.customerBike.create({
                        data: {
                            customerId: input.customerId,
                            branchId,
                            serialNumber: item.serialNumber,
                            brand: "EVOBIKE",
                            model: item.name,
                            notes: `Venta original Folio pendiente`
                        }
                    });
                }
            }

            // B. Create the Sale record FIRST to get its ID for KARDEX
            const subTotalCalc = input.total / 1.16;
            const prefix = input.isLayaway ? "A" : "V";
            const folioGen = `${prefix}-${Date.now().toString().slice(-6)}`; // Simple folio generator

            const sale = await tx.sale.create({
                data: {
                    folio: folioGen,
                    branchId: branchId,
                    userId: userId,
                    customerId: input.customerId, // Explicitly pass the customer for regular sales too if provided
                    status: input.isLayaway ? "LAYAWAY" : "COMPLETED",
                    subtotal: subTotalCalc,
                    total: input.total,
                    items: {
                        create: input.items.map(item => ({
                            modeloConfiguracionId: item.modeloConfiguracionId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });

            // C. Create Inventory Movement (KARDEX) for each item, using the Sale ID as reference
            for (const item of input.items) {
                await tx.inventoryMovement.create({
                    data: {
                        modeloConfiguracionId: item.modeloConfiguracionId,
                        branchId: branchId,
                        userId: userId,
                        type: "SALE",
                        quantity: -item.quantity,
                        referenceId: sale.id
                    }
                });
            }

            // D. Link CashTransaction for the Income Payment
            // For layaways, we register the downPayment. For standard sales, the full total.
            const paymentAmount = input.isLayaway ? (input.downPayment || 0) : input.total;

            if (paymentAmount > 0) {
                await tx.cashTransaction.create({
                    data: {
                        sessionId: activeSession.id,
                        saleId: sale.id,
                        type: "PAYMENT_IN",
                        method: input.paymentMethod,
                        amount: paymentAmount
                    }
                });
            }

            return sale;
        });

        // 2. Clear Next.js cache so the frontend stock is updated immediately
        revalidatePath("/point-of-sale");
        revalidatePath("/customers"); // Revalidate customers to update balances

        return { success: true, saleId: result.id };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al procesar la venta";
        return { success: false, error: message };
    }
}
