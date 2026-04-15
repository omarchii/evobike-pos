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

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
});

interface SessionUser {
  id: string;
  branchId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: saleId } = await params;

    const body: unknown = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 422 }
      );
    }

    const { amount, paymentMethod } = parsed.data;

    await requireActiveUser(session);

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Caja cerrada. Abre la caja para registrar pagos." },
        { status: 409 }
      );
    }
    assertSessionFreshOrThrow(activeSession);

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { payments: true },
      });

      if (!sale) {
        throw new Error("Pedido no encontrado");
      }
      if (sale.branchId !== branchId) {
        throw new Error("No autorizado para este pedido");
      }
      if (sale.status !== "LAYAWAY") {
        throw new Error("Este pedido ya fue liquidado o cancelado");
      }

      const totalPaid = sale.payments.reduce(
        (acc, p) => acc + Number(p.amount),
        0
      );
      const pending = Number(sale.total) - totalPaid;

      if (amount > pending) {
        throw new Error(
          `El monto excede el saldo pendiente ($${pending.toFixed(2)})`
        );
      }

      await tx.cashTransaction.create({
        data: {
          sessionId: activeSession.id,
          userId,
          saleId: sale.id,
          type: "PAYMENT_IN",
          method: paymentMethod,
          amount,
        },
      });

      if (totalPaid + amount >= Number(sale.total)) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: "COMPLETED" },
        });
      }
    });

    return NextResponse.json({ success: true });
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
    console.error("[api/pedidos/[id]/payments POST]", error);
    const message = error instanceof Error ? error.message : "Error al registrar el pago";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
