import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["TECHNICIAN", "MANAGER", "ADMIN"];

const uninstallSchema = z.object({
  customerBikeId: z.string().min(1, "customerBikeId requerido"),
});

// PATCH /api/batteries/uninstall — desinstalar baterías de un vehículo
// Marca BatteryAssignment.isCurrent = false y Battery.status = IN_STOCK
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, role, branchId } = session.user as unknown as SessionUser;

  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: "No tienes permisos para desinstalar baterías" },
      { status: 403 }
    );
  }

  const body: unknown = await req.json();
  const parsed = uninstallSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { customerBikeId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cargar BatteryAssignments activos del vehículo
      const activeAssignments = await tx.batteryAssignment.findMany({
        where: { customerBikeId, isCurrent: true },
        select: {
          id: true,
          batteryId: true,
          battery: { select: { branchId: true, serialNumber: true } },
        },
      });

      if (activeAssignments.length === 0) {
        throw new Error("Este vehículo no tiene baterías instaladas actualmente");
      }

      // 2. Validar acceso por sucursal (excepto ADMIN)
      if (role !== "ADMIN") {
        const outsideBranch = activeAssignments.find(
          (a) => a.battery.branchId !== branchId
        );
        if (outsideBranch) {
          throw new Error("No tienes acceso a baterías de otra sucursal");
        }
      }

      const now = new Date();
      const batteryIds = activeAssignments.map((a) => a.batteryId);
      const assignmentIds = activeAssignments.map((a) => a.id);

      // 3. Marcar assignments como inactivos
      await tx.batteryAssignment.updateMany({
        where: { id: { in: assignmentIds } },
        data: {
          isCurrent: false,
          unassignedAt: now,
          unassignedByUserId: userId,
        },
      });

      // 4. Regresar baterías a IN_STOCK
      await tx.battery.updateMany({
        where: { id: { in: batteryIds } },
        data: { status: "IN_STOCK" },
      });

      return { uninstalledCount: batteryIds.length };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al desinstalar baterías";
    const isBusinessError =
      error instanceof Error &&
      (message.includes("instaladas") ||
        message.includes("sucursal") ||
        message.includes("acceso"));
    return NextResponse.json(
      { success: false, error: message },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
