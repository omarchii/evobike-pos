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
import {
  assertQaPassed,
  assertPolicyActive,
  QaNotPassedError,
  PolicyNotActiveError,
} from "@/lib/workshop";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";

const deliverSchema = z.object({
  // Payment fields: solo aplican cuando type = PAID y !prepaid.
  // Para WARRANTY/COURTESY/POLICY_MAINTENANCE se aceptan en el payload
  // (backward compat con UIs viejas) pero se ignoran con console.warn.
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]).optional(),
  amount: z.number().nonnegative().optional(),
  secondaryPaymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "ATRATO"]).optional(),
  secondaryAmount: z.number().nonnegative().optional(),
});

// POST /api/service-orders/[id]/deliver
// Matriz por ServiceOrder.type (decisión #7 BRIEF + matriz QA #9):
//   PAID                → exige QA; flujo actual (caja, CashTransaction).
//                         Si prepaid: usa la Sale existente, no cobra de nuevo.
//   WARRANTY            → exige QA; crea Sale(total=0) sin CashTransaction.
//   POLICY_MAINTENANCE  → exige QA + assertPolicyActive (no-op hoy); idem.
//   COURTESY            → exento de QA; crea Sale(total=0) sin CashTransaction.
// En los tres tipos no-PAID el descuento de stock (WORKSHOP_USAGE) se mantiene.
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
  const branchId = await resolveOperationalBranchId({ user });

  if (branchId === "__none__") {
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
    await requireActiveUser(session);

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
        branch: { select: { requireQaSecondChecker: true } },
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

    // ── QA gate (exento COURTESY) ──
    assertQaPassed(order);

    // ── Second-checker (D.1) ──
    // Solo dispara cuando AMBOS IDs existen y coinciden. Órdenes legacy sin
    // servicedByUserId quedan exentas — no es guard incompleto, es la única
    // política aplicable sin reescribir histórico.
    if (
      order.type !== "COURTESY" &&
      order.branch.requireQaSecondChecker &&
      order.servicedByUserId &&
      order.qaPassedByUserId &&
      order.servicedByUserId === order.qaPassedByUserId
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "QA_SECOND_CHECKER_REQUIRED",
          error: "Se requiere un segundo revisor para QA",
        },
        { status: 422 },
      );
    }

    // ── Coherencia prepaid × type ──
    if (order.prepaid && order.type !== "PAID") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Orden con cobro anticipado pero tipo distinto a PAID — revisar inconsistencia",
        },
        { status: 422 },
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

    // ── Determinar flujo de cobro según type ──
    //   PAID !prepaid  → requiere payment data + caja abierta
    //   PAID  prepaid  → usa Sale existente
    //   otros          → crea Sale(total=0), ignora payment data con warn
    let activeSessionId: string | null = null;
    const requiresPaymentFlow = order.type === "PAID" && !order.prepaid;

    if (requiresPaymentFlow) {
      if (!input.paymentMethod || input.amount === undefined) {
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

      const activeSession = await getActiveSession(branchId);
      if (!activeSession) {
        return NextResponse.json({ success: false, error: "No hay caja abierta" }, { status: 409 });
      }
      assertSessionFreshOrThrow(activeSession);
      activeSessionId = activeSession.id;
    } else if (order.type === "PAID" && order.prepaid) {
      if (!order.sale) {
        return NextResponse.json(
          { success: false, error: "No se encontró la venta asociada al cobro previo" },
          { status: 422 }
        );
      }
    } else {
      // WARRANTY / COURTESY / POLICY_MAINTENANCE → sin cobro.
      // Si el payload trajo campos de pago, dejamos traza (no silent-ignore).
      if (
        input.paymentMethod ||
        input.amount !== undefined ||
        input.secondaryPaymentMethod ||
        input.secondaryAmount !== undefined
      ) {
        console.warn(
          `[service-orders/${serviceOrderId}/deliver] ignorando datos de pago — type=${order.type} no cobra.`,
        );
      }
    }

    // ── Single transaction ──
    const result = await prisma.$transaction(async (tx) => {
      let saleId: string;
      let folio: string;

      if (requiresPaymentFlow) {
        // Branch A — PAID no prepaid: crear Sale + CashTransaction
        const updatedBranch = await tx.branch.update({
          where: { id: branchId },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true, code: true },
        });
        const newFolio = `${updatedBranch.code}T-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

        // Invariante Sale.type (ver schema.prisma): serviceOrderId != null →
        // type=SERVICE, orderType=null. excludeFromRevenue=false — rama A es
        // PAID no prepaid, el cobro genera ingreso real.
        const sale = await tx.sale.create({
          data: {
            folio: newFolio,
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

        await tx.cashTransaction.create({
          data: {
            sessionId: activeSessionId!,
            userId,
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
              userId,
              saleId: sale.id,
              type: "PAYMENT_IN",
              method: input.secondaryPaymentMethod,
              amount: input.secondaryAmount!,
              collectionStatus:
                input.secondaryPaymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
            },
          });
        }

        saleId = sale.id;
        folio = newFolio;
      } else if (order.type === "PAID" && order.prepaid) {
        // Branch B — PAID prepaid: ya cobrado previamente
        saleId = order.sale!.id;
        folio = order.sale!.folio;
      } else {
        // Branch C — WARRANTY / COURTESY / POLICY_MAINTENANCE:
        // crea Sale(total=0) para traza, sin CashTransaction.
        if (order.type === "POLICY_MAINTENANCE") {
          await assertPolicyActive(order.customerBikeId ?? "", tx);
        }

        const updatedBranch = await tx.branch.update({
          where: { id: branchId },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true, code: true },
        });
        const newFolio = `${updatedBranch.code}T-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

        // Invariante Sale.type (ver schema.prisma): serviceOrderId != null →
        // type=SERVICE, orderType=null. excludeFromRevenue=true — rama C
        // (WARRANTY/COURTESY/POLICY_MAINTENANCE) no genera ingreso real
        // (total=0, sin CashTransaction); filtrada de KPIs en E.5.
        const sale = await tx.sale.create({
          data: {
            folio: newFolio,
            branchId,
            userId,
            customerId: order.customerId,
            status: "COMPLETED",
            type: "SERVICE",
            excludeFromRevenue: true,
            subtotal: 0,
            discount: 0,
            total: 0,
            warrantyDocReady: true,
            serviceOrderId: order.id,
            internalNote: `Servicio sin cobro — tipo ${order.type}`,
          },
        });

        saleId = sale.id;
        folio = newFolio;
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
    if (error instanceof QaNotPassedError || error instanceof PolicyNotActiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 },
      );
    }
    console.error("[api/service-orders/[id]/deliver POST]", error);
    const message = error instanceof Error ? error.message : "Error al procesar la entrega";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
