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
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";
import { paymentMethodsArraySchema } from "@/lib/validators/payment";
import { createPaymentInTransactions } from "@/lib/cash-transaction";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// Pack E.7 — shape unificado: paymentMethods[] reemplaza paymentMethod /
// secondaryPaymentMethod / secondaryAmount.
const chargeSchema = z.object({
  paymentMethods: paymentMethodsArraySchema,
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

  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const branchId = await getViewBranchId();

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
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
    // Guard de type (E.3.c): WARRANTY/COURTESY/POLICY_MAINTENANCE no cobran,
    // aunque el JWT del solicitante tenga rol MANAGER. Complementa el gate UI.
    if (order.type !== "PAID") {
      return NextResponse.json(
        { success: false, error: "Esta orden no genera cobro" },
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

    // Validate payment amounts sum to total (Pack E.7)
    const paymentTotal = input.paymentMethods.reduce((s, e) => s + e.amount, 0);
    if (Math.abs(paymentTotal - total) > 0.01) {
      return NextResponse.json(
        { success: false, error: "Los montos de pago no suman el total de la orden" },
        { status: 422 }
      );
    }

    // CREDIT_BALANCE pre-flight (necesita customerId del cliente del taller)
    const creditEntry = input.paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
    if (creditEntry) {
      if (!order.customerId) {
        return NextResponse.json(
          { success: false, error: "Saldo a favor requiere cliente asignado a la orden" },
          { status: 422 },
        );
      }
      const { total: available } = await getCustomerCreditBalance(order.customerId);
      if (available < creditEntry.amount) {
        return NextResponse.json(
          {
            success: false,
            error: `Saldo insuficiente. El cliente tiene $${available.toFixed(2)} a favor.`,
          },
          { status: 422 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Generate sequential folio — same atomic pattern as sales
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, code: true },
      });
      const folio = `${updatedBranch.code}T-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      // Create service Sale (serviceOrderId links it back).
      // Invariante Sale.type (ver schema.prisma): serviceOrderId != null → type=SERVICE,
      // orderType=null. excludeFromRevenue=false porque el cobro genera ingreso real.
      const sale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId: order.customerId,
          status: "COMPLETED",
          type: "SERVICE",
          excludeFromRevenue: false,
          subtotal: total,
          discount: 0,
          total,
          warrantyDocReady: true,
          serviceOrderId: order.id,
        },
      });

      // CashTransactions (Pack E.7 helper centralizado)
      await createPaymentInTransactions(tx, {
        saleId: sale.id,
        sessionId: activeSession.id,
        userId,
        customerId: order.customerId,
        entries: input.paymentMethods,
      });

      // Mark service order as prepaid + populate audit trail (Hotfix.1 fields).
      // Pack E.7: prepaidMethod dropeado del schema; consumers derivan ahora
      // desde Sale.payments[] (ver derivePrepaidMethodFromPayments).
      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          prepaid: true,
          prepaidAt: new Date(),
          prepaidAmount: paymentTotal,
        },
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
