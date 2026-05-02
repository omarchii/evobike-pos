import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  getActiveSession,
  assertSessionFreshOrThrow,
  OrphanedCashSessionError,
} from "@/lib/cash-register";
import { paymentMethodsArraySchema } from "@/lib/validators/payment";
import { createPaymentInTransactions } from "@/lib/cash-transaction";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// Pack E.6 — shape unificado: paymentMethods[] reemplaza paymentMethod single.
// Permite abonos con CREDIT_BALANCE / ATRATO (antes solo CASH/CARD/TRANSFER).
const paymentSchema = z.object({
  paymentMethods: paymentMethodsArraySchema,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { id: userId, branchId } = session.user as unknown as BranchedSessionUser;
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

    const { paymentMethods } = parsed.data;
    const submitTotal = paymentMethods.reduce((s, e) => s + e.amount, 0);

    if (submitTotal <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto del abono debe ser mayor a 0" },
        { status: 422 },
      );
    }

    await requireActiveUser(session);

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Caja cerrada. Abre la caja para registrar pagos." },
        { status: 409 }
      );
    }
    assertSessionFreshOrThrow(activeSession);

    // Pack E.6 — Race protection. SELECT FOR UPDATE bloquea la fila Sale
    // hasta el COMMIT, garantizando que dos abonos concurrentes no excedan
    // el saldo pendiente (TOCTOU latente cerrado, Pack C.1 Q6 INT-2).
    await prisma.$transaction(
      async (tx) => {
        const lockedRows = await tx.$queryRaw<
          Array<{ id: string; total: string; status: string; branchId: string; customerId: string | null }>
        >`SELECT id, total::text AS total, status::text AS status, "branchId", "customerId"
          FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;
        if (lockedRows.length === 0) throw new Error("Pedido no encontrado");
        const sale = lockedRows[0];

        if (sale.branchId !== branchId) {
          throw new Error("No autorizado para este pedido");
        }
        if (sale.status !== "LAYAWAY") {
          throw new Error("Este pedido ya fue liquidado o cancelado");
        }

        const collectedAgg = await tx.cashTransaction.aggregate({
          where: { saleId, type: "PAYMENT_IN" },
          _sum: { amount: true },
        });
        const totalPaid = Number(collectedAgg._sum.amount ?? 0);
        const saleTotal = Number(sale.total);
        const pending = saleTotal - totalPaid;

        if (submitTotal > pending + 0.005) {
          throw new Error(
            `El monto excede el saldo pendiente ($${pending.toFixed(2)})`,
          );
        }

        // CREDIT_BALANCE pre-flight (necesita customerId vinculado al pedido).
        const creditEntry = paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
        if (creditEntry) {
          if (!sale.customerId) {
            throw new Error("Saldo a favor requiere cliente asignado al pedido");
          }
          const { total: available } = await getCustomerCreditBalance(sale.customerId, tx);
          if (available < creditEntry.amount) {
            throw new Error(
              `Saldo insuficiente. El cliente tiene $${available.toFixed(2)} a favor.`,
            );
          }
        }

        await createPaymentInTransactions(tx, {
          saleId,
          sessionId: activeSession.id,
          userId,
          customerId: sale.customerId,
          entries: paymentMethods,
        });

        if (totalPaid + submitTotal >= saleTotal - 0.005) {
          await tx.sale.update({
            where: { id: saleId },
            data: { status: "COMPLETED" },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
