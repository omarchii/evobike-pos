import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["TECHNICIAN", "MANAGER", "ADMIN"];

const completeSchema = z.object({
  batterySerials: z
    .array(z.string().min(1))
    .min(1, "Se requiere al menos un número de serie"),
  lotReference: z.string().min(1, "El número de lote es requerido"),
  // vin requerido cuando la orden no tiene customerBike (generada por recepción)
  vin: z
    .string()
    .min(3, "El VIN debe tener al menos 3 caracteres")
    .transform((v) => v.trim().toUpperCase())
    .optional(),
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

  const { id: userId, role, branchId } = session.user as unknown as BranchedSessionUser;

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

  const { batterySerials, lotReference, vin } = parsed.data;

  // Validar duplicados antes de entrar a la transacción
  const uniqueSerials = new Set(batterySerials);
  if (uniqueSerials.size !== batterySerials.length) {
    return NextResponse.json(
      { success: false, error: "Hay números de serie duplicados en el listado" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cargar la orden
      const order = await tx.assemblyOrder.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          branchId: true,
          customerBikeId: true,
          productVariantId: true,
          saleId: true,
          productVariant: {
            select: {
              id: true,
              modelo_id: true,
              voltaje_id: true,
              modelo: { select: { nombre: true } },
              voltaje: { select: { label: true } },
              color: { select: { nombre: true } },
            },
          },
        },
      });

      if (!order) throw new Error("Orden de montaje no encontrada");
      if (role !== "ADMIN" && order.branchId !== branchId) throw new Error("No tienes acceso a esta orden de montaje");
      if (order.status !== "PENDING") {
        throw new Error(
          `No se puede completar una orden con status "${order.status}". Solo se pueden completar órdenes PENDING.`
        );
      }

      // 2. Resolver customerBikeId
      let resolvedCustomerBikeId: string;

      if (order.customerBikeId) {
        resolvedCustomerBikeId = order.customerBikeId;
      } else {
        if (!vin) throw new Error("Se requiere el VIN para completar esta orden de montaje");
        if (!order.productVariant) throw new Error("La orden no tiene variante de producto asociada");

        const vinExists = await tx.customerBike.findFirst({
          where: { serialNumber: vin, branchId: order.branchId },
          select: { id: true },
        });
        if (vinExists) throw new Error(`El VIN ${vin} ya está registrado en esta sucursal`);

        const newBike = await tx.customerBike.create({
          data: {
            branchId: order.branchId,
            productVariantId: order.productVariant.id,
            serialNumber: vin,
            brand: "EVOBIKE",
            model: order.productVariant.modelo.nombre,
            voltaje: order.productVariant.voltaje.label,
            color: order.productVariant.color.nombre,
          },
        });

        await tx.assemblyOrder.update({
          where: { id: order.id },
          data: { customerBikeId: newBike.id },
        });

        resolvedCustomerBikeId = newBike.id;
      }

      // 3. Obtener BatteryConfiguration (cantidad requerida + variante de batería)
      const orderBranchId = order.branchId;
      let requiredQuantity: number | null = null;
      let batteryVariantId: string | null = null;

      if (order.productVariant) {
        // TODO I10 deferred (Pack A.2 §1.3.6 I10.5): este endpoint todavía picksolo arbitrario
        // si hay multi-config para (modelo, voltaje) — bug ACTIVO Evotank 45/52Ah desde 2026-04-19.
        // Migrar a resolveConfigForBike(BatteryConfigKey) cuando S4 conecte el selector V·Ah POS
        // y `assemblyOrder` reciba batteryCapacidadId del flujo de creación.
        const candidates = await tx.batteryConfiguration.findMany({
          where: {
            modeloId: order.productVariant.modelo_id,
            voltajeId: order.productVariant.voltaje_id,
          },
          select: { quantity: true, batteryVariantId: true },
        });
        if (candidates.length > 1) {
          console.warn(
            `[I10-deferred] ${candidates.length} configs para (${order.productVariant.modelo_id}, ${order.productVariant.voltaje_id}) en /api/assembly/[id]/complete, picking arbitrary. Bug S1 ACTIVO. Migrar a resolveConfigForBike post-S4.`
          );
        }
        const batteryConfig = candidates[0] ?? null;
        requiredQuantity = batteryConfig?.quantity ?? null;
        batteryVariantId = batteryConfig?.batteryVariantId ?? null;
      }

      if (requiredQuantity !== null && batterySerials.length !== requiredQuantity) {
        throw new Error(
          `Se requieren ${requiredQuantity} baterías para este vehículo, pero se proporcionaron ${batterySerials.length}`
        );
      }

      // 4. Separar seriales existentes vs. nuevos
      const existingBatteries = await tx.battery.findMany({
        where: { serialNumber: { in: batterySerials } },
        select: { id: true, serialNumber: true, status: true, branchId: true },
      });

      const existingSerialSet = new Set(existingBatteries.map((b) => b.serialNumber));
      const newSerials = batterySerials.filter((s) => !existingSerialSet.has(s));

      // 5. Validar baterías existentes
      for (const battery of existingBatteries) {
        if (role !== "ADMIN" && battery.branchId !== orderBranchId) {
          throw new Error(`La batería ${battery.serialNumber} pertenece a otra sucursal`);
        }
        if (battery.status !== "IN_STOCK") {
          throw new Error(
            `La batería ${battery.serialNumber} no está disponible (status: ${battery.status})`
          );
        }
      }

      // 6. Auto-crear BatteryLot + Battery para seriales nuevos
      let newBatteryIds: string[] = [];

      if (newSerials.length > 0) {
        if (!batteryVariantId) {
          throw new Error("No se puede registrar baterías nuevas: falta la configuración de variante de batería para este modelo");
        }

        const lot = await tx.batteryLot.create({
          data: {
            productVariantId: batteryVariantId,
            branchId: orderBranchId,
            reference: lotReference,
            userId,
          },
        });

        await tx.battery.createMany({
          data: newSerials.map((serial) => ({
            serialNumber: serial,
            lotId: lot.id,
            branchId: orderBranchId,
            status: "IN_STOCK" as const,
          })),
        });

        const createdBatteries = await tx.battery.findMany({
          where: { serialNumber: { in: newSerials } },
          select: { id: true },
        });
        newBatteryIds = createdBatteries.map((b) => b.id);
      }

      // 7. Reunir todos los IDs de baterías
      const allBatteryIds = [
        ...existingBatteries.map((b) => b.id),
        ...newBatteryIds,
      ];

      // 8. Crear BatteryAssignments
      await tx.batteryAssignment.createMany({
        data: allBatteryIds.map((batteryId) => ({
          batteryId,
          customerBikeId: resolvedCustomerBikeId,
          assemblyOrderId: order.id,
          assignedByUserId: userId,
          isCurrent: true,
        })),
      });

      // 9. Marcar todas las baterías como INSTALLED
      await tx.battery.updateMany({
        where: { id: { in: allBatteryIds } },
        data: { status: "INSTALLED" },
      });

      // 10. Completar la orden
      const completedAt = new Date();
      await tx.assemblyOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED", assembledByUserId: userId, completedAt },
      });

      // 11. Trigger warrantyDocReady — si todas las AssemblyOrder de esta venta están completas
      if (order.saleId) {
        const pendingCount = await tx.assemblyOrder.count({
          where: { saleId: order.saleId, status: "PENDING" },
        });
        if (pendingCount === 0) {
          await tx.sale.update({
            where: { id: order.saleId },
            data: { warrantyDocReady: true },
          });
        }
      }

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
        message.includes("no encontrada") ||
        message.includes("acceso") ||
        message.includes("VIN") ||
        message.includes("variante") ||
        message.includes("lote"));
    return NextResponse.json(
      { success: false, error: message },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
