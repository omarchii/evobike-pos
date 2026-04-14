import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  getActiveSession,
  assertSessionFreshOrThrow,
  OrphanedCashSessionError,
} from "@/lib/cash-register";

interface AuthUser {
  id: string;
  branchId: string;
  role: string;
}

const chargeSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]),
  amount: z.number().positive("El monto debe ser mayor a cero"),
  secondaryPaymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]).optional(),
  secondaryAmount: z.number().nonnegative().optional(),
});

// POST /api/service-orders/[id]/charge
// Cobra anticipadamente una ServiceOrder COMPLETED. Crea Sale tipo SERVICE
// (identificada por serviceOrderId) + CashTransaction. Marca prepaid = true.
// No descuenta stock — eso ocurre al entregar (D3).
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
  const parsed = chargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Sin acceso a esta orden" }, { status: 403 });
    }
    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "La orden debe estar completada para cobrar" },
        { status: 422 }
      );
    }
    if (order.prepaid) {
      return NextResponse.json(
        { success: false, error: "Esta orden ya fue cobrada" },
        { status: 422 }
      );
    }

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json({ success: false, error: "No hay caja abierta" }, { status: 409 });
    }
    assertSessionFreshOrThrow(activeSession);

    // Calculate total from items
    const total = order.items.reduce(
      (acc, item) => acc + Number(item.price) * item.quantity,
      0
    );

    // Validate payment amounts sum to total
    const paymentTotal = input.amount + (input.secondaryAmount ?? 0);
    if (Math.abs(paymentTotal - total) > 0.01) {
      return NextResponse.json(
        { success: false, error: "Los montos de pago no suman el total de la orden" },
        { status: 422 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Generate sequential folio — same atomic pattern as sales
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, code: true },
      });
      const folio = `${updatedBranch.code}T-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      // Create service Sale (serviceOrderId links it back)
      const sale = await tx.sale.create({
        data: {
          folio,
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

      // Primary payment
      await tx.cashTransaction.create({
        data: {
          sessionId: activeSession.id,
          saleId: sale.id,
          type: "PAYMENT_IN",
          method: input.paymentMethod,
          amount: input.amount,
          collectionStatus: input.paymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
        },
      });

      // Secondary payment (split)
      if (input.secondaryPaymentMethod && (input.secondaryAmount ?? 0) > 0) {
        await tx.cashTransaction.create({
          data: {
            sessionId: activeSession.id,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: input.secondaryPaymentMethod,
            amount: input.secondaryAmount!,
            collectionStatus: input.secondaryPaymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
          },
        });
      }

      // Mark service order as prepaid
      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { prepaid: true },
      });

      return { saleId: sale.id, folio: sale.folio };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof OrphanedCashSessionError) {
      return NextResponse.json(
        {
          success: false,
          error: "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones.",
        },
        { status: 409 },
      );
    }
    console.error("[api/service-orders/[id]/charge POST]", error);
    const message = error instanceof Error ? error.message : "Error al procesar el cobro";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
