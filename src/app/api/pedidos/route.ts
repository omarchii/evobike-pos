import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const pedidoSchema = z.object({
  customerId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  depositAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
  orderType: z.enum(["LAYAWAY", "BACKORDER"]),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

interface SessionUser {
  id: string;
  branchId: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { id: userId, branchId } = session.user as unknown as SessionUser;
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json();
    const parsed = pedidoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 422 }
      );
    }

    const {
      customerId,
      productVariantId,
      quantity,
      unitPrice,
      depositAmount,
      paymentMethod,
      orderType,
      expectedDeliveryDate,
      notes,
    } = parsed.data;

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Caja cerrada. Abre la caja para registrar pedidos." },
        { status: 400 }
      );
    }

    const total = unitPrice * quantity;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Stock check and decrement (solo LAYAWAY)
      if (orderType === "LAYAWAY") {
        const stock = await tx.stock.findUnique({
          where: {
            productVariantId_branchId: { productVariantId, branchId },
          },
        });
        if (!stock || stock.quantity < quantity) {
          throw new Error("Stock insuficiente para apartar este producto");
        }
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: quantity } },
        });
      }

      // 2. Folio secuencial
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, name: true },
      });
      const branchPrefix = updatedBranch.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 3)
        .toUpperCase();
      const folioPrefix = orderType === "LAYAWAY" ? "A" : "B";
      const folio = `${branchPrefix}${folioPrefix}-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      // 3. Crear Sale
      const sale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId,
          status: "LAYAWAY",
          orderType,
          subtotal: total,
          discount: 0,
          total,
          notes: notes ?? null,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        },
      });

      // 4. Crear SaleItem
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productVariantId,
          quantity,
          price: unitPrice,
          discount: 0,
        },
      });

      // 5. Crear CashTransaction con el depósito inicial
      if (depositAmount > 0) {
        await tx.cashTransaction.create({
          data: {
            sessionId: activeSession.id,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: paymentMethod,
            amount: depositAmount,
          },
        });
      }

      return { saleId: sale.id, folio: sale.folio };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear el pedido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
