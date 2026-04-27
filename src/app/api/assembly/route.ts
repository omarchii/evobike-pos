import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ── GET /api/assembly — Listar órdenes de montaje ─────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as SessionUser;
  if (role !== "ADMIN" && !branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }
  const branchFilter = role === "ADMIN" ? {} : { branchId: branchId! };

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const validStatuses = ["PENDING", "COMPLETED", "CANCELLED"] as const;
  type StatusType = (typeof validStatuses)[number];
  const statusFilter: { status?: StatusType | { in: StatusType[] } } =
    statusParam && validStatuses.includes(statusParam as StatusType)
      ? { status: statusParam as StatusType }
      : { status: { in: ["PENDING", "COMPLETED"] } };

  try {
    const orders = await prisma.assemblyOrder.findMany({
      where: { ...branchFilter, ...statusFilter },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        notes: true,
        createdAt: true,
        completedAt: true,
        saleId: true,
        voltageChangeLogId: true,
        // customerBike es ahora nullable (órdenes de recepción sin VIN)
        customerBike: {
          select: {
            id: true,
            serialNumber: true,
            model: true,
            color: true,
            voltaje: true,
            customer: { select: { id: true, name: true } },
            batteryAssignments: {
              where: { isCurrent: true },
              select: {
                battery: {
                  select: {
                    serialNumber: true,
                    status: true,
                    lot: { select: { reference: true } },
                  },
                },
              },
            },
          },
        },
        // productVariant para órdenes generadas por recepción (sin customerBike)
        productVariant: {
          select: {
            id: true,
            sku: true,
            modelo_id: true,
            voltaje_id: true,
            modelo: { select: { nombre: true } },
            color: { select: { nombre: true } },
            voltaje: { select: { label: true } },
          },
        },
        assembledBy: { select: { id: true, name: true } },
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      status: o.status,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
      saleId: o.saleId ?? null,
      voltageChangeLogId: o.voltageChangeLogId ?? null,
      customerBike: o.customerBike
        ? {
            id: o.customerBike.id,
            serialNumber: o.customerBike.serialNumber,
            model: o.customerBike.model,
            color: o.customerBike.color,
            voltaje: o.customerBike.voltaje,
            customer: o.customerBike.customer ?? null,
          }
        : null,
      productVariant: o.productVariant
        ? {
            id: o.productVariant.id,
            sku: o.productVariant.sku,
            modeloId: o.productVariant.modelo_id,
            voltajeId: o.productVariant.voltaje_id,
            modeloNombre: o.productVariant.modelo.nombre,
            colorNombre: o.productVariant.color.nombre,
            voltajeLabel: o.productVariant.voltaje.label,
          }
        : null,
      assembledBy: o.assembledBy ?? null,
      batteryAssignments: (o.customerBike?.batteryAssignments ?? []).map((ba) => ({
        serialNumber: ba.battery.serialNumber,
        status: ba.battery.status,
        lotReference: ba.battery.lot.reference,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al listar órdenes";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST /api/assembly — Crear orden de montaje ───────────────────────────────

const createAssemblySchema = z.object({
  modeloId: z.string().min(1, "Modelo requerido"),
  voltajeId: z.string().min(1, "Voltaje requerido"),
  colorId: z.string().min(1, "Color requerido"),
  vin: z
    .string()
    .min(3, "El VIN debe tener al menos 3 caracteres")
    .transform((v) => v.trim().toUpperCase()),
  batterySerials: z.array(z.string().min(1)).optional(),
  completeNow: z.boolean().default(true),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, branchId } = guard.user;

  const body: unknown = await req.json();
  const parsed = createAssemblySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { modeloId, voltajeId, colorId, vin, batterySerials, completeNow, notes } = parsed.data;

  // Si va a completar, necesita los seriales
  if (completeNow && (!batterySerials || batterySerials.length === 0)) {
    return NextResponse.json(
      { success: false, error: "Se requieren los números de serie de las baterías para completar el montaje" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar VIN único en la sucursal
      const vinExists = await tx.customerBike.findFirst({
        where: { serialNumber: vin, branchId },
        select: { id: true },
      });
      if (vinExists) {
        throw new Error(`El VIN ${vin} ya está registrado en esta sucursal`);
      }

      // 2. Obtener ProductVariant
      const productVariant = await tx.productVariant.findFirst({
        where: { modelo_id: modeloId, voltaje_id: voltajeId, color_id: colorId },
        select: {
          id: true,
          modelo: { select: { nombre: true } },
          voltaje: { select: { label: true } },
          color: { select: { nombre: true } },
        },
      });
      if (!productVariant) {
        throw new Error(
          "No existe una variante de producto para la combinación Modelo/Voltaje/Color seleccionada"
        );
      }

      // 3. Buscar BatteryConfiguration → requiredQuantity
      // TODO I10 deferred (Pack A.2 §1.3.6 I10.5): este endpoint todavía picksolo arbitrario
      // si hay multi-config para (modelo, voltaje) — bug ACTIVO Evotank 45/52Ah desde 2026-04-19.
      // Migrar a resolveConfigForBike(BatteryConfigKey) cuando S4 conecte el selector V·Ah POS
      // y este endpoint reciba batteryCapacidadId del cliente.
      const batteryCandidates = await tx.batteryConfiguration.findMany({
        where: { modeloId, voltajeId },
        select: { quantity: true },
      });
      if (batteryCandidates.length === 0) {
        throw new Error(
          `No hay configuración de baterías para ${productVariant.modelo.nombre} ${productVariant.voltaje.label}. Configúrala en el catálogo primero.`
        );
      }
      if (batteryCandidates.length > 1) {
        console.warn(
          `[I10-deferred] ${batteryCandidates.length} configs para (${modeloId}, ${voltajeId}) en /api/assembly POST, picking arbitrary. Bug S1 ACTIVO. Migrar a resolveConfigForBike post-S4.`
        );
      }
      const batteryConfig = batteryCandidates[0];

      const requiredQuantity = batteryConfig.quantity;

      // 4. Crear CustomerBike (sin cliente — vehículo pre-venta)
      const customerBike = await tx.customerBike.create({
        data: {
          branchId,
          productVariantId: productVariant.id,
          serialNumber: vin,
          brand: "EVOBIKE",
          model: productVariant.modelo.nombre,
          voltaje: productVariant.voltaje.label,
          color: productVariant.color.nombre,
          notes: notes ?? null,
        },
      });

      // 5. Manejar seriales si se va a completar ahora
      if (completeNow) {
        const serials = batterySerials!;

        if (serials.length !== requiredQuantity) {
          throw new Error(
            `Se requieren ${requiredQuantity} baterías para ${productVariant.modelo.nombre} ${productVariant.voltaje.label}, pero se proporcionaron ${serials.length}`
          );
        }

        const uniqueSerials = new Set(serials);
        if (uniqueSerials.size !== serials.length) {
          throw new Error("Hay números de serie duplicados en el listado");
        }

        const batteries = await tx.battery.findMany({
          where: { serialNumber: { in: serials } },
          select: { id: true, serialNumber: true, status: true, branchId: true },
        });

        if (batteries.length !== serials.length) {
          const found = new Set(batteries.map((b) => b.serialNumber));
          const missing = serials.filter((s) => !found.has(s));
          throw new Error(
            `Los siguientes seriales no están registrados en el sistema: ${missing.join(", ")}`
          );
        }

        for (const battery of batteries) {
          if (battery.branchId !== branchId) {
            throw new Error(`La batería ${battery.serialNumber} pertenece a otra sucursal`);
          }
          if (battery.status !== "IN_STOCK") {
            throw new Error(
              `La batería ${battery.serialNumber} no está disponible (status: ${battery.status})`
            );
          }
        }

        const assemblyOrder = await tx.assemblyOrder.create({
          data: {
            customerBikeId: customerBike.id,
            productVariantId: productVariant.id,
            branchId,
            status: "COMPLETED",
            assembledByUserId: userId,
            completedAt: new Date(),
            notes: notes ?? null,
          },
        });

        await tx.batteryAssignment.createMany({
          data: batteries.map((battery) => ({
            batteryId: battery.id,
            customerBikeId: customerBike.id,
            assemblyOrderId: assemblyOrder.id,
            assignedByUserId: userId,
            isCurrent: true,
          })),
        });

        await tx.battery.updateMany({
          where: { id: { in: batteries.map((b) => b.id) } },
          data: { status: "INSTALLED" },
        });

        return {
          id: assemblyOrder.id,
          status: "COMPLETED" as const,
          customerBikeId: customerBike.id,
          vin,
        };
      } else {
        const assemblyOrder = await tx.assemblyOrder.create({
          data: {
            customerBikeId: customerBike.id,
            productVariantId: productVariant.id,
            branchId,
            status: "PENDING",
            notes: notes ?? null,
          },
        });

        return {
          id: assemblyOrder.id,
          status: "PENDING" as const,
          customerBikeId: customerBike.id,
          vin,
        };
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear la orden de montaje";
    const isBusinessError =
      error instanceof Error &&
      (message.includes("VIN") ||
        message.includes("requieren") ||
        message.includes("disponible") ||
        message.includes("sucursal") ||
        message.includes("variante") ||
        message.includes("configuración") ||
        message.includes("duplicados") ||
        message.includes("registrados"));
    return NextResponse.json(
      { success: false, error: message },
      { status: isBusinessError ? 422 : 500 }
    );
  }
}
