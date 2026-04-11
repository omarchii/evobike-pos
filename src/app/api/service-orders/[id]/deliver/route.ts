import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface AuthUser {
  id: string;
  branchId: string;
  role: string;
}

const deliverSchema = z.object({
  // Payment fields only required when not prepaid
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]).optional(),
  amount: z.number().nonnegative().optional(),
  secondaryPaymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]).optional(),
  secondaryAmount: z.number().nonnegative().optional(),
});

// POST /api/service-orders/[id]/deliver
// Entrega la orden.
// - Si prepaid === false: crea Sale + CashTransaction (requiere caja abierta).
// - Si prepaid === true: usa la Sale ya existente, no cobra de nuevo.
// En ambos casos: descuenta Stock y crea InventoryMovement(WORKSHOP_USAGE) para cada
// item con productVariantId que no tenga inventoryMovementId aún (D3 del spec).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as AuthUser;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        items: {
          include: {
            productVariant: {
              include: { modelo: true, color: true },
            },
          },
        },
        sale: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Sin acceso a esta orden" }, { status: 403 });
    }
    if (order.status === "DELIVERED") {
      return NextResponse.json(
        { success: false, error: "La orden ya fue entregada" },
        { status: 422 }
      );
    }
    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "La orden debe estar completada para entregar" },
        { status: 422 }
      );
    }

    // ── Pre-validate stock (outside transaction for clear error messages) ──
    // Aggregate total quantities needed per productVariantId (D3/T4 spec).
    // Only process items without inventoryMovementId — those are pending stock deduction.
    const neededByVariant = new Map<string, { quantity: number; name: string }>();
    for (const item of order.items) {
      if (!item.productVariantId || item.inventoryMovementId !== null) continue;
      const current = neededByVariant.get(item.productVariantId);
      const name = item.productVariant
        ? `${item.productVariant.modelo.nombre} ${item.productVariant.color.nombre}`
        : item.description;
      neededByVariant.set(item.productVariantId, {
        quantity: (current?.quantity ?? 0) + item.quantity,
        name: current?.name ?? name,
      });
    }

    for (const [variantId, { quantity, name }] of neededByVariant.entries()) {
      const stock = await prisma.stock.findUnique({
        where: { productVariantId_branchId: { productVariantId: variantId, branchId } },
      });
      if (!stock || stock.quantity < quantity) {
        return NextResponse.json(
          { success: false, error: `Stock insuficiente para: ${name}` },
          { status: 422 }
        );
      }
    }

    const total = order.items.reduce(
      (acc, item) => acc + Number(item.price) * item.quantity,
      0
    );

    // ── Validate payment data for non-prepaid orders ──
    let activeSessionId: string | null = null;
    if (!order.prepaid) {
      if (!input.paymentMethod || (input.amount === undefined)) {
        return NextResponse.json(
          { success: false, error: "Método y monto de pago requeridos" },
          { status: 400 }
        );
      }
      const paymentTotal = input.amount + (input.secondaryAmount ?? 0);
      if (Math.abs(paymentTotal - total) > 0.01) {
        return NextResponse.json(
          { success: false, error: "Los montos de pago no suman el total de la orden" },
          { status: 422 }
        );
      }

      const activeSession = await prisma.cashRegisterSession.findFirst({
        where: { userId, branchId, status: "OPEN" },
      });
      if (!activeSession) {
        return NextResponse.json({ success: false, error: "No hay caja abierta" }, { status: 422 });
      }
      activeSessionId = activeSession.id;
    } else {
      if (!order.sale) {
        return NextResponse.json(
          { success: false, error: "No se encontró la venta asociada al cobro previo" },
          { status: 422 }
        );
      }
    }

    // ── Single transaction: cobro + stock + status ──
    const result = await prisma.$transaction(async (tx) => {
      let saleId: string;
      let folio: string;

      if (!order.prepaid) {
        // Branch A: crear Sale + CashTransaction
        const updatedBranch = await tx.branch.update({
          where: { id: branchId },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true, code: true },
        });
        const newFolio = `${updatedBranch.code}T-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

        const sale = await tx.sale.create({
          data: {
            folio: newFolio,
            branchId,
            userId,
            customerId: order.customerId,
            status: "COMPLETED",
            subtotal: total,
            discount: 0,
            total,
            warrantyDocReady: true,
            serviceOrderId: order.id,
          },
        });

        await tx.cashTransaction.create({
          data: {
            sessionId: activeSessionId!,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: input.paymentMethod!,
            amount: input.amount!,
            collectionStatus: input.paymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
          },
        });

        if (input.secondaryPaymentMethod && (input.secondaryAmount ?? 0) > 0) {
          await tx.cashTransaction.create({
            data: {
              sessionId: activeSessionId!,
              saleId: sale.id,
              type: "PAYMENT_IN",
              method: input.secondaryPaymentMethod,
              amount: input.secondaryAmount!,
              collectionStatus: input.secondaryPaymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
            },
          });
        }

        saleId = sale.id;
        folio = newFolio;
      } else {
        // Branch B: ya cobrado previamente
        saleId = order.sale!.id;
        folio = order.sale!.folio;
      }

      // Common: descuento de stock + InventoryMovement por cada item sin movement
      for (const item of order.items) {
        if (!item.productVariantId || item.inventoryMovementId !== null) continue;

        await tx.stock.update({
          where: {
            productVariantId_branchId: {
              productVariantId: item.productVariantId,
              branchId,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            branchId,
            userId,
            type: "WORKSHOP_USAGE",
            quantity: -item.quantity,
            referenceId: serviceOrderId,
          },
        });

        await tx.serviceOrderItem.update({
          where: { id: item.id },
          data: { inventoryMovementId: movement.id },
        });
      }

      // Mark delivered
      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { status: "DELIVERED" },
      });

      return { saleId, folio };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar la entrega";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
