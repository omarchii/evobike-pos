import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { INTERNAL_APPROVAL_CHANNELS } from "@/lib/workshop-enums";
import {
  applyApprovalDecisionTx,
  ApprovalNotFoundError,
  ApprovalAlreadyRespondedError,
  ApprovalItemsCorruptError,
} from "@/lib/workshop-approvals";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

const respondSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  // WHATSAPP_PUBLIC se reserva al endpoint público sin auth — acá solo
  // canales de registro interno (llamada, presencial, otro).
  channel: z.enum(INTERNAL_APPROVAL_CHANNELS),
  note: z.string().max(1000).optional(),
});

// POST /api/service-orders/[id]/approvals/[approvalId]/respond
// Registra respuesta interna al trabajo extra (llamada al cliente,
// atención presencial, u otro canal). Si APPROVED, crea los
// ServiceOrderItem del snapshot con isExtra=true y recalcula totales.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const branchId = await getViewBranchId();
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 },
    );
  }
  if (user.role === "SELLER") {
    return NextResponse.json(
      { success: false, error: "Sin permisos para registrar aprobaciones" },
      { status: 403 },
    );
  }

  const { id: serviceOrderId, approvalId } = await params;

  const body: unknown = await req.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { id: true, branchId: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: "Sin acceso a esta orden" },
        { status: 403 },
      );
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        {
          success: false,
          error: "No se pueden modificar aprobaciones de órdenes cerradas",
        },
        { status: 422 },
      );
    }

    // ── Lazy expiry race-safe (D.2) ──
    // updateMany con WHERE condicional es atómico: si dos requests
    // intentan responder el mismo approval después del TTL, solo uno
    // marca EXPIRED y el otro ve count=0 (porque ya cambió a REJECTED).
    const expired = await prisma.serviceOrderApproval.updateMany({
      where: {
        id: approvalId,
        serviceOrderId,
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
        respondedNote: "EXPIRED",
      },
    });
    if (expired.count === 1) {
      // Limpiar subStatus si la orden quedó esperando esta approval
      // (no hay otras aprobaciones PENDING activas — el helper también
      // verificaría, pero acá ya sabemos que esta era la que trababa).
      await prisma.serviceOrder.updateMany({
        where: { id: serviceOrderId, subStatus: "WAITING_APPROVAL" },
        data: { subStatus: null },
      });
      return NextResponse.json(
        {
          success: false,
          code: "APPROVAL_EXPIRED",
          error: "Esta solicitud expiró",
        },
        { status: 410 },
      );
    }

    const result = await prisma.$transaction((tx) =>
      applyApprovalDecisionTx(tx, {
        approvalId,
        serviceOrderId,
        decision: input.decision,
        channel: input.channel,
        note: input.note ?? null,
      }),
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    if (error instanceof ApprovalNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 },
      );
    }
    if (error instanceof ApprovalAlreadyRespondedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    }
    if (error instanceof ApprovalItemsCorruptError) {
      console.error(
        "[api/service-orders/[id]/approvals/[approvalId]/respond] itemsJson corrupto",
        { serviceOrderId, approvalId },
      );
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }
    console.error("[api/service-orders/[id]/approvals/[approvalId]/respond POST]", error);
    const message =
      error instanceof Error ? error.message : "Error al responder la aprobación";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
