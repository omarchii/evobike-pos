"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface SessionUser {
  id: string;
  branchId: string;
}

export interface PaymentMethodInput {
  method: "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";
  amount: number;
  reference?: string;
}

interface SaleItemInput {
  productVariantId: string;
  quantity: number;
  price: number;
  name: string;
  isSerialized?: boolean;
  serialNumber?: string;
  batterySerials?: string[];
  assemblyMode?: boolean;
}

interface SaleInput {
  items: SaleItemInput[];
  total: number;
  discount?: number;
  paymentMethods: PaymentMethodInput[];
  isLayaway?: boolean;
  customerId?: string;
  downPayment?: number;
  internalNote?: string;
  discountAmount?: number;
  discountAuthorizedByUserId?: string;
  discountAuthorizedByName?: string;
}

export async function processSaleAction(input: SaleInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "No autorizado" };

    const { id: userId, branchId } = session.user as unknown as SessionUser;
    if (!branchId) return { success: false, error: "Usuario sin sucursal asignada" };

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });
    if (!activeSession) {
      return { success: false, error: "Debes abrir caja antes de poder realizar ventas." };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "El carrito está vacío" };
    }

    if (input.isLayaway) {
      if (!input.customerId) return { success: false, error: "Un apartado requiere asignar un cliente" };
      if (input.downPayment === undefined || input.downPayment < 0)
        return { success: false, error: "Monto de abono inicial no válido" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // CREDIT_BALANCE pre-flight check
      const creditPayment = input.paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
      if (creditPayment) {
        if (!input.customerId) throw new Error("Se requiere un cliente para pagar con Saldo a Favor");
        const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
        if (!customer || Number(customer.balance) < creditPayment.amount) {
          throw new Error(
            `Saldo insuficiente. El cliente tiene $${customer?.balance ?? 0} a favor.`
          );
        }
        await tx.customer.update({
          where: { id: input.customerId },
          data: { balance: { decrement: creditPayment.amount } },
        });
      }

      // A. Verify and decrease stock
      for (const item of input.items) {
        const stock = await tx.stock.findUnique({
          where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId } },
        });

        // Assembly mode: no stock to decrement (the bike isn't in stock — we're assembling it)
        if (item.assemblyMode) continue;

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para: ${item.name}`);
        }
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: item.quantity } },
        });

        // VIN registration
        if (item.isSerialized && item.serialNumber) {
          if (!input.customerId) {
            throw new Error(
              `${item.name} requiere un número de serie — debes seleccionar un cliente.`
            );
          }
          const existingBike = await tx.customerBike.findFirst({
            where: { serialNumber: item.serialNumber, branchId },
          });
          if (existingBike) {
            throw new Error(`Número de serie ya registrado: ${item.serialNumber}`);
          }
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
            include: { voltaje: true },
          });
          await tx.customerBike.create({
            data: {
              customerId: input.customerId,
              branchId,
              serialNumber: item.serialNumber,
              brand: "EVOBIKE",
              model: item.name,
              voltaje: variant?.voltaje.label ?? null,
              notes: "Venta original",
            },
          });
        }
      }

      // B. Build internal note
      let finalNote = input.internalNote ?? "";
      if (input.discountAmount && input.discountAmount > 0 && input.discountAuthorizedByName) {
        const discountLine = `\nDescuento $${input.discountAmount.toFixed(2)} autorizado por ${input.discountAuthorizedByName}`;
        finalNote = finalNote ? `${finalNote}${discountLine}` : discountLine.trimStart();
      }

      // C. Generate sequential folio
      const subTotalCalc = (input.total - (input.discount ?? 0)) / 1.16;
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, name: true },
      });
      const branchPrefix = updatedBranch.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 3)
        .toUpperCase();
      const saleType = input.isLayaway ? "A" : "V";
      const folio = `${branchPrefix}${saleType}-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId: input.customerId ?? null,
          status: input.isLayaway ? "LAYAWAY" : "COMPLETED",
          subtotal: subTotalCalc,
          discount: input.discount ?? 0,
          total: input.total,
          internalNote: finalNote || null,
          items: {
            create: input.items.map((item) => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      });

      // D. Inventory movements (skip assembly-mode items)
      for (const item of input.items) {
        if (item.assemblyMode) continue;
        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            branchId,
            userId,
            type: "SALE",
            quantity: -item.quantity,
            referenceId: sale.id,
          },
        });
      }

      // E. Cash transactions (one per payment method)
      const paymentTotal = input.isLayaway ? (input.downPayment ?? 0) : input.total;
      const paymentsToRegister =
        paymentTotal > 0 && input.paymentMethods.length > 0
          ? input.paymentMethods
          : [];

      for (const pm of paymentsToRegister) {
        if (pm.amount <= 0) continue;
        await tx.cashTransaction.create({
          data: {
            sessionId: activeSession.id,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: pm.method,
            amount: pm.amount,
            reference: pm.reference,
            collectionStatus: pm.method === "ATRATO" ? "PENDING" : "COLLECTED",
          },
        });
      }

      // F. Battery assignments
      for (const item of input.items) {
        if (!item.batterySerials || item.batterySerials.length === 0) continue;
        if (!input.customerId) continue;

        // Find the CustomerBike just created
        const customerBike = item.serialNumber
          ? await tx.customerBike.findFirst({
              where: { serialNumber: item.serialNumber, branchId },
            })
          : null;

        if (!customerBike) continue;

        for (const batterySerial of item.batterySerials) {
          const battery = await tx.battery.findFirst({
            where: { serialNumber: batterySerial, branchId, status: "IN_STOCK" },
          });
          if (!battery) continue;

          await tx.batteryAssignment.create({
            data: {
              batteryId: battery.id,
              customerBikeId: customerBike.id,
              isCurrent: true,
              assignedByUserId: userId,
            },
          });

          await tx.battery.update({
            where: { id: battery.id },
            data: { status: "INSTALLED" },
          });
        }
      }

      return sale;
    });

    revalidatePath("/point-of-sale");
    revalidatePath("/customers");

    return { success: true, saleId: result.id, folio: result.folio };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar la venta";
    return { success: false, error: message };
  }
}
