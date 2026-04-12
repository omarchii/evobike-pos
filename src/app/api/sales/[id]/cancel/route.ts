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

const cancelSchema = z.object({
  motivo: z.string().min(1, "El motivo de cancelación es obligatorio"),
});

// POST /api/sales/[id]/cancel
// Solo MANAGER y ADMIN pueden cancelar.
// 1. Revierte stock por cada SaleItem con productVariantId
// 2. Crea CashTransaction(REFUND_OUT) por cada cobro registrado (si hay sesión abierta)
// 3. Revierte voltaje de CustomerBike si la venta tenía VoltageChangeLog
// 4. Cancela AssemblyOrders PENDING vinculadas a esta venta
// 5. Cancela CommissionRecords PENDING/APPROVED vinculados a esta venta
// 6. Marca Sale.status = CANCELLED
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as AuthUser;

  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Sin permisos para cancelar ventas" },
      { status: 403 }
    );
  }

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id: saleId } = await params;

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
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          select: { id: true, productVariantId: true, quantity: true, isFreeForm: true },
        },
        payments: {
          where: { type: "PAYMENT_IN" },
          select: { id: true, method: true, amount: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });
    }
    if (role !== "ADMIN" && sale.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Sin acceso a esta venta" }, { status: 403 });
    }
    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "La venta ya está cancelada" },
        { status: 422 }
      );
    }

    // Fetch voltage change logs for this sale (for reversal)
    const voltageChangeLogs = await prisma.voltageChangeLog.findMany({
      where: { saleId },
      select: { id: true, customerBikeId: true, fromVoltage: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Restore stock for each catalog item
      for (const item of sale.items) {
        if (item.isFreeForm || !item.productVariantId) continue;
        await tx.stock.updateMany({
          where: {
            productVariantId: item.productVariantId,
            branchId: sale.branchId,
          },
          data: { quantity: { increment: item.quantity } },
        });
      }

      // 2. Create REFUND_OUT cash transactions if cash session is open
      const activeSession = await tx.cashRegisterSession.findFirst({
        where: { branchId: sale.branchId, status: "OPEN" },
        select: { id: true },
      });
      if (activeSession) {
        for (const payment of sale.payments) {
          await tx.cashTransaction.create({
            data: {
              sessionId: activeSession.id,
              saleId: sale.id,
              type: "REFUND_OUT",
              method: payment.method,
              amount: payment.amount,
              reference: `Devolución por cancelación: ${motivo}`,
              collectionStatus: "COLLECTED",
            },
          });
        }
      }

      // 3. Revert CustomerBike voltage for each VoltageChangeLog
      for (const log of voltageChangeLogs) {
        await tx.customerBike.update({
          where: { id: log.customerBikeId },
          data: { voltaje: log.fromVoltage || null },
        });
      }

      // 4. Cancel PENDING AssemblyOrders linked to this sale
      await tx.assemblyOrder.updateMany({
        where: { saleId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      // 5. Cancel pending/approved commissions
      await tx.commissionRecord.updateMany({
        where: { saleId, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });

      // 6. Mark Sale as CANCELLED with reason in internalNote
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "CANCELLED",
          internalNote: sale.internalNote
            ? `${sale.internalNote}\nCancelación: ${motivo}`
            : `Cancelación: ${motivo}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al cancelar la venta";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
