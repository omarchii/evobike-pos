import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ServiceOrderStatus, Prisma } from "@prisma/client";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";

const statusSchema = z.object({
  currentStatus: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"]),
});

// PATCH /api/workshop/orders/[id]/status — avanzar estado Kanban.
// Al entrar a COMPLETED autollena servicedByUserId con session.userId si
// estaba vacío (trazabilidad Opción A, decisión #2 BRIEF). Idempotente:
// re-transiciones o triggers manuales no sobrescriben el primer ejecutor.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const branchId = await resolveOperationalBranchId({ user });
  const { id: orderId } = await params;

  const body: unknown = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Estado inválido" }, { status: 400 });
  }

  const { currentStatus } = parsed.data;

  let newStatus: ServiceOrderStatus;
  switch (currentStatus) {
    case "PENDING":
      newStatus = "IN_PROGRESS";
      break;
    case "IN_PROGRESS":
      newStatus = "COMPLETED";
      break;
    default:
      return NextResponse.json(
        { success: false, error: "Estado no válido para avanzar." },
        { status: 400 }
      );
  }

  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, branchId: true, servicedByUserId: true, subStatus: true },
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

    const data: Prisma.ServiceOrderUpdateInput = { status: newStatus };

    // Trazabilidad: primer ejecutor que cierra a COMPLETED queda registrado.
    if (newStatus === "COMPLETED" && !order.servicedByUserId) {
      data.servicedByUser = { connect: { id: userId } };
    }

    // Al salir de IN_PROGRESS el subStatus deja de aplicar.
    if (currentStatus === "IN_PROGRESS" && order.subStatus !== null) {
      data.subStatus = null;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: orderId },
      data,
    });

    return NextResponse.json({ success: true, data: { newStatus: updated.status } });
  } catch (error: unknown) {
    console.error("[api/workshop/orders/[id]/status PATCH]", error);
    const message = error instanceof Error ? error.message : "Error al actualizar el estado";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
