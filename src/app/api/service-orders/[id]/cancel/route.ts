import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

const cancelSchema = z.object({
  motivo: z.string().min(1, "El motivo de cancelación es obligatorio"),
});

// POST /api/service-orders/[id]/cancel
// Solo MANAGER y ADMIN pueden cancelar.
// Si la orden está prepagada: marca la Sale como CANCELLED y crea CashTransaction(REFUND_OUT)
// para registrar la devolución en auditoría.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const userId = user.id;

  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Sin permisos para cancelar órdenes" },
      { status: 403 }
    );
  }

  const branchId = await getViewBranchId();
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 }
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { motivo } = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        sale: {
          include: { payments: { where: { type: "PAYMENT_IN" } } },
        },
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
        { success: false, error: "No se puede cancelar una orden ya entregada" },
        { status: 422 }
      );
    }
    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "La orden ya está cancelada" },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Si estaba prepagada, revertir el cobro
      if (order.prepaid && order.sale) {
        await tx.sale.update({
          where: { id: order.sale.id },
          data: {
            status: "CANCELLED",
            internalNote: `Cancelación: ${motivo}`,
          },
        });

        // Buscar sesión de caja abierta en la sucursal para registrar la devolución
        const activeSession = await tx.cashRegisterSession.findFirst({
          where: { branchId, status: "OPEN" },
        });

        if (activeSession) {
          // Crear transacción inversa por cada cobro original
          for (const payment of order.sale.payments) {
            await tx.cashTransaction.create({
              data: {
                sessionId: activeSession.id,
                userId,
                saleId: order.sale.id,
                type: "REFUND_OUT",
                method: payment.method,
                amount: payment.amount,
                reference: `Devolución por cancelación: ${motivo}`,
                collectionStatus: "COLLECTED",
              },
            });
          }
        }
      }

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { status: "CANCELLED", subStatus: null },
      });

      // Auto-rechazar approvals pendientes para evitar que queden visibles
      // en el portal público del cliente tras la cancelación.
      await tx.serviceOrderApproval.updateMany({
        where: { serviceOrderId, status: "PENDING" },
        data: {
          status: "REJECTED",
          respondedAt: new Date(),
          respondedNote: `Orden cancelada: ${motivo}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al cancelar la orden";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
