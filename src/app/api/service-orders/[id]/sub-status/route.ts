import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { SERVICE_ORDER_SUB_STATUS } from "@/lib/workshop-enums";
import { validateBranchWriteAccess } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

const subStatusSchema = z.object({
  // null limpia el sub-estado.
  subStatus: z.enum(SERVICE_ORDER_SUB_STATUS).nullable(),
  branchId: z.string().min(1).optional(),
});

// POST /api/service-orders/[id]/sub-status
// Sub-estados solo válidos cuando status = IN_PROGRESS (decisión #8 BRIEF).
// WAITING_PARTS | WAITING_APPROVAL | PAUSED | null (limpia).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  if (user.role === "SELLER") {
    // SELLER no trabaja órdenes de taller: solo operativos (TECHNICIAN/MANAGER/ADMIN).
    return NextResponse.json(
      { success: false, error: "Sin permisos para modificar sub-estado" },
      { status: 403 },
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = subStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Sub-estado inválido" },
      { status: 400 },
    );
  }
  const { subStatus, branchId } = parsed.data;

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: {
        id: true,
        branchId: true,
        status: true,
        subStatus: true,
        type: true,
        assignedTechId: true,
        partRequestedAt: true,
      },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    const branchAccess = validateBranchWriteAccess(user, order.branchId, branchId);
    if (!branchAccess.success) {
      return NextResponse.json(
        { success: false, error: branchAccess.error },
        { status: branchAccess.status },
      );
    }
    if (user.role === "TECHNICIAN" && order.assignedTechId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Solo puedes modificar órdenes asignadas a ti" },
        { status: 403 },
      );
    }

    // WARRANTY orders: WAITING_PARTS transitions are MANAGER/ADMIN only
    const touchesWaitingParts =
      subStatus === "WAITING_PARTS" || order.subStatus === "WAITING_PARTS";
    if (
      order.type === "WARRANTY" &&
      touchesWaitingParts &&
      user.role === "TECHNICIAN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "En órdenes de garantía, solo MANAGER puede gestionar Esperando Pieza",
        },
        { status: 403 },
      );
    }

    if (order.status !== "IN_PROGRESS") {
      return NextResponse.json(
        {
          success: false,
          error: "El sub-estado solo aplica mientras la orden está en proceso",
        },
        { status: 422 },
      );
    }

    // Auto-set partRequestedAt / partReceivedAt timestamps
    const timestampData: Record<string, Date> = {};
    const now = new Date();
    if (subStatus === "WAITING_PARTS" && !order.partRequestedAt) {
      timestampData.partRequestedAt = now;
    }
    if (
      order.subStatus === "WAITING_PARTS" &&
      subStatus === null
    ) {
      timestampData.partReceivedAt = now;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { subStatus, ...timestampData },
      select: { id: true, subStatus: true },
    });

    console.log(
      "[workshop-mobile]",
      JSON.stringify({
        userId: user.id,
        role: user.role,
        orderId: serviceOrderId,
        action: "sub-status",
        mobileClient: req.headers.get("x-client") === "mobile-dashboard",
        ts: new Date().toISOString(),
      }),
    );

    return NextResponse.json({
      success: true,
      data: { id: updated.id, subStatus: updated.subStatus },
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    console.error("[api/service-orders/[id]/sub-status POST]", error);
    const message =
      error instanceof Error ? error.message : "Error al actualizar el sub-estado";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
