import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  role: string;
  branchId: string;
}

const ALLOWED_ROLES = ["TECHNICIAN", "MANAGER", "ADMIN"];

const completeSchema = z.object({
  batterySerials: z
    .array(z.string().min(1))
    .min(1, "Se requiere al menos un número de serie"),
});

// PATCH /api/assembly/[id]/complete — Completar montaje pendiente
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, role, branchId } = session.user as unknown as SessionUser;

  // Solo TECHNICIAN, MANAGER y ADMIN pueden completar montajes
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: "No tienes permisos para completar órdenes de montaje" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const body: unknown = await req.json();
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { batterySerials } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cargar la orden con sus relaciones
      const order = await tx.assemblyOrder.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          branchId: true,
          customerBikeId: true,
          customerBike: {
            select: {
              id: true,
              model: true,
              voltaje: true,
              // Para obtener modeloId y voltajeId necesitamos el productVariant
            },
          },
        },
      });

      if (!order) {
        throw new Error("Orden de montaje no encontrada");
      }

      // 2. Validar que pertenece a la sucursal del usuario (excepto ADMIN)
      if (role !== "ADMIN" && order.branchId !== branchId) {
        throw new Error("No tienes acceso a esta orden de montaje");
      }

      // 3. Validar status PENDING
      if (order.status !== "PENDING") {
        throw new Error(
          `No se puede completar una orden con status "${order.status}". Solo se pueden completar órdenes PENDING.`
        );
      }

      // 4. Obtener la BatteryConfiguration para saber cuántas baterías se requieren
      // Buscamos via el modelo y voltaje del CustomerBike (guardados como strings)
      // Necesitamos encontrar el Voltaje por label
      const voltajeRecord = order.customerBike.voltaje
        ? await tx.voltaje.findFirst({
            where: { label: order.customerBike.voltaje },
            select: { id: true },
          })
        : null;

      const modeloRecord = order.customerBike.model
        ? await tx.modelo.findUnique({
            where: { nombre: order.customerBike.model },
            select: { id: true },
          })
        : null;

      let requiredQuantity: number | null = null;

      if (voltajeRecord && modeloRecord) {
        const batteryConfig = await tx.batteryConfiguration.findFirst({
          where: { modeloId: modeloRecord.id, voltajeId: voltajeRecord.id },
          select: { quantity: true },
        });
        requiredQuantity = batteryConfig?.quantity ?? null;
      }

      if (requiredQuantity !== null && batterySerials.length !== requiredQuantity) {
        throw new Error(
          `Se requieren ${requiredQuantity} baterías para este vehículo, pero se proporcionaron ${batterySerials.length}`
        );
      }

      // 5. Validar duplicados en el input
      const uniqueSerials = new Set(batterySerials);
      if (uniqueSerials.size !== batterySerials.length) {
        throw new Error("Hay números de serie duplicados en el listado");
      }

      // 6. Cargar baterías de DB y validar
      const batteries = await tx.battery.findMany({
        where: { serialNumber: { in: batterySerials } },
        select: { id: true, serialNumber: true, status: true, branchId: true },
      });

      if (batteries.length !== batterySerials.length) {
        const found = new Set(batteries.map((b) => b.serialNumber));
        const missing = batterySerials.filter((s) => !found.has(s));
        throw new Error(
          `Los siguientes seriales no están registrados: ${missing.join(", ")}`
        );
      }

      for (const battery of batteries) {
        if (role !== "ADMIN" && battery.branchId !== branchId) {
          throw new Error(`La batería ${battery.serialNumber} pertenece a otra sucursal`);
        }
        if (battery.status !== "IN_STOCK") {
          throw new Error(
            `La batería ${battery.serialNumber} no está disponible (status: ${battery.status})`
          );
        }
      }

      // 7. Crear BatteryAssignment × N
      await tx.batteryAssignment.createMany({
        data: batteries.map((battery) => ({
          batteryId: battery.id,
          customerBikeId: order.customerBikeId,
          assemblyOrderId: order.id,
          assignedByUserId: userId,
          isCurrent: true,
        })),
      });

      // 8. Actualizar Battery.status → INSTALLED
      await tx.battery.updateMany({
        where: { id: { in: batteries.map((b) => b.id) } },
        data: { status: "INSTALLED" },
      });

      // 9. Actualizar AssemblyOrder → COMPLETED
      const completedAt = new Date();
      await tx.assemblyOrder.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          assembledByUserId: userId,
          completedAt,
        },
      });

      return { id: order.id, status: "COMPLETED" as const, completedAt: completedAt.toISOString() };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al completar el montaje";
    const isBusinessError =
      error instanceof Error &&
      (message.includes("status") ||
        message.includes("requieren") ||
        message.includes("disponible") ||
        message.includes("sucursal") ||
        message.includes("duplicados") ||
        message.includes("registrados") ||
        message.includes("no encontrada") ||
        message.includes("acceso"));
    return NextResponse.json(
      { success: false, error: message },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
