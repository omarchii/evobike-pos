import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/assembly/[id]/cancel — Cancelar orden pendiente
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as BranchedSessionUser;
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.assemblyOrder.findUnique({
        where: { id },
        select: { id: true, status: true, branchId: true },
      });

      if (!order) {
        throw new Error("Orden de montaje no encontrada");
      }

      // Validar acceso por sucursal (excepto ADMIN)
      if (role !== "ADMIN" && order.branchId !== branchId) {
        throw new Error("No tienes acceso a esta orden de montaje");
      }

      // Solo se pueden cancelar órdenes PENDING
      // Las completadas requieren desinstalación (Fase 2H-4 → Taller)
      if (order.status !== "PENDING") {
        throw new Error(
          `No se puede cancelar una orden con status "${order.status}". Solo se pueden cancelar órdenes PENDING. Para desinstalar baterías de un montaje completado, usa el módulo de Taller.`
        );
      }

      // Liberar baterías pre-reservadas (S3) para que vuelvan al pool disponible.
      await tx.battery.updateMany({
        where: { assemblyOrderId: id },
        data: { assemblyOrderId: null },
      });

      await tx.assemblyOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { id, status: "CANCELLED" as const };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al cancelar la orden";
    const isBusinessError =
      error instanceof Error &&
      (message.includes("status") ||
        message.includes("no encontrada") ||
        message.includes("acceso"));
    return NextResponse.json(
      { success: false, error: message },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
