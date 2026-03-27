"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ServiceOrderStatus } from "@prisma/client";

interface SessionUser {
    id: string;
    branchId: string;
}

// Mover una orden entre columnas del Kanban
// Nota: la transición COMPLETED → DELIVERED se maneja vía POST /api/workshop/deliver
// porque requiere cobro (CashTransaction). Este action solo avanza hasta COMPLETED.
export async function updateServiceOrderStatus(orderId: string, currentStatus: ServiceOrderStatus) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        let newStatus: ServiceOrderStatus;

        switch (currentStatus) {
            case "PENDING":
                newStatus = "IN_PROGRESS";
                break;
            case "IN_PROGRESS":
                newStatus = "COMPLETED";
                break;
            default:
                return { success: false, error: "Estado no válido para avanzar." };
        }

        const updated = await prisma.serviceOrder.update({
            where: { id: orderId },
            data: { status: newStatus }
        });

        revalidatePath("/workshop");
        return { success: true, newStatus: updated.status };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al actualizar el estado";
        return { success: false, error: message };
    }
}

interface NewOrderInput {
    customerId?: string;
    customerBikeId?: string;
    customerName: string;
    customerPhone?: string;
    bikeInfo: string;
    diagnosis: string;
}

// Crear nueva orden desde el Front Desk
export async function createServiceOrder(input: NewOrderInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as unknown as SessionUser;

        if (!branchId) return { success: false, error: "Empleado sin sucursal asignada." };

        // UPSERT Customer by phone or name (simplified logic)
        let customer;
        if (input.customerId) {
            customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
        } else if (input.customerPhone) {
            customer = await prisma.customer.findUnique({ where: { phone: input.customerPhone } });
        }

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    name: input.customerName,
                    phone: input.customerPhone || null,
                }
            });
        } else if (!input.customerId && customer.name !== input.customerName) {
            // Option to update name if same phone is used
            customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { name: input.customerName }
            });
        }

        const folioGen = `TS-${Date.now().toString().slice(-5)}`;

        const newOrder = await prisma.serviceOrder.create({
            data: {
                folio: folioGen,
                branchId,
                userId,
                customerId: customer.id,
                customerBikeId: input.customerBikeId || null,
                bikeInfo: input.bikeInfo,
                diagnosis: input.diagnosis,
                status: "PENDING"
            }
        });

        revalidatePath("/workshop");
        return { success: true, orderId: newOrder.id, folio: newOrder.folio };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al crear la orden";
        return { success: false, error: message };
    }
}

// Agregar item a orden de servicio.
// Si el item tiene modeloConfiguracionId, verifica stock, lo descuenta
// y registra un InventoryMovement(WORKSHOP_USAGE) dentro de una $transaction.
export async function addServiceOrderItem(data: {
    serviceOrderId: string;
    modeloConfiguracionId?: string;
    description: string;
    quantity: number;
    price: number;
}) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as unknown as SessionUser;

        if (!branchId) return { success: false, error: "Empleado sin sucursal asignada" };

        const order = await prisma.serviceOrder.findUnique({ where: { id: data.serviceOrderId } });
        if (!order) return { success: false, error: "Orden no encontrada" };

        if (order.status === "DELIVERED" || order.status === "CANCELLED") {
            return { success: false, error: "No se puede modificar una orden cerrada/cancelada" };
        }

        await prisma.$transaction(async (tx) => {
            // Si es una refacción de inventario, verificar y descontar stock
            if (data.modeloConfiguracionId) {
                const stock = await tx.stock.findUnique({
                    where: {
                        modeloConfiguracionId_branchId: {
                            modeloConfiguracionId: data.modeloConfiguracionId,
                            branchId
                        }
                    }
                });

                if (!stock || stock.quantity < data.quantity) {
                    throw new Error("Stock insuficiente para la refacción seleccionada");
                }

                await tx.stock.update({
                    where: { id: stock.id },
                    data: { quantity: { decrement: data.quantity } }
                });

                await tx.inventoryMovement.create({
                    data: {
                        modeloConfiguracionId: data.modeloConfiguracionId,
                        branchId,
                        userId,
                        type: "WORKSHOP_USAGE",
                        quantity: -data.quantity,
                        referenceId: data.serviceOrderId
                    }
                });
            }

            await tx.serviceOrderItem.create({
                data: {
                    serviceOrderId: data.serviceOrderId,
                    modeloConfiguracionId: data.modeloConfiguracionId ?? null,
                    description: data.description,
                    quantity: data.quantity,
                    price: data.price
                }
            });

            // Recalcular totales con los ítems actualizados
            const items = await tx.serviceOrderItem.findMany({
                where: { serviceOrderId: data.serviceOrderId }
            });
            const subtotal = items.reduce(
                (acc, item) => acc + Number(item.price) * item.quantity,
                0
            );

            await tx.serviceOrder.update({
                where: { id: data.serviceOrderId },
                data: { subtotal, total: subtotal }
            });
        });

        revalidatePath(`/workshop/${data.serviceOrderId}`);
        revalidatePath("/workshop");

        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al agregar el concepto";
        return { success: false, error: message };
    }
}


// Remover item 
export async function removeServiceOrderItem(itemId: string, serviceOrderId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const order = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
        if (!order) return { success: false, error: "Orden no encontrada" };
        if (order.status === "DELIVERED" || order.status === "CANCELLED") {
            return { success: false, error: "No se puede modificar una orden cerrada" };
        }

        await prisma.serviceOrderItem.delete({ where: { id: itemId } });

        // Update Totals
        const items = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId } });
        const subtotal = items.reduce((acc, current) => acc + (Number(current.price) * current.quantity), 0);
        const total = subtotal;

        await prisma.serviceOrder.update({
            where: { id: serviceOrderId },
            data: { subtotal, total }
        });

        revalidatePath(`/workshop/${serviceOrderId}`);
        revalidatePath("/workshop");

        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al eliminar el concepto";
        return { success: false, error: message };
    }
}
