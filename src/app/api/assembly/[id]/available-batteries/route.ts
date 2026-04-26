import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findConfigsByModelVoltage } from "@/lib/battery-configurations";

interface SessionUser {
  id: string;
  role: string;
  branchId: string;
}

// GET /api/assembly/[id]/available-batteries
// Devuelve los lotes compatibles (tipo batería correcto, IN_STOCK >= 1) para una AssemblyOrder.
// Cada lote incluye sus primeros `requiredQuantity` seriales IN_STOCK.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as SessionUser;
  const { id } = await params;

  try {
    // 1. Cargar la orden (incluye config pre-asignada si existe).
    const order = await prisma.assemblyOrder.findUnique({
      where: { id },
      select: {
        branchId: true,
        productVariantId: true,
        batteryConfigurationId: true,
        productVariant: {
          select: { modelo_id: true, voltaje_id: true },
        },
        batteryConfiguration: {
          select: { batteryVariantId: true, quantity: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    if (role !== "ADMIN" && order.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // 2. Resolver config: si la orden tiene una pre-asignada (recepción acoplada S3),
    // usar esa. Si no, fallback al helper canónico — sigue picksolo arbitrario para
    // multi-config Evotank, pero ahora con visibilidad explícita vía console.warn.
    // TODO I10 deferred (Pack A.2 §1.3.6): migrar a resolveConfigForBike(BatteryConfigKey)
    // cuando S4 incluya batteryCapacidadId en la firma del endpoint o pre-asigne config.
    let batteryConfig: { batteryVariantId: string; quantity: number } | null =
      order.batteryConfiguration;

    if (!batteryConfig && order.productVariant) {
      const candidates = await findConfigsByModelVoltage(
        order.productVariant.modelo_id,
        order.productVariant.voltaje_id,
      );
      if (candidates.length > 1) {
        console.warn(
          `[I10-deferred] ${candidates.length} configs para (${order.productVariant.modelo_id}, ${order.productVariant.voltaje_id}) en /api/assembly/[id]/available-batteries fallback, picking arbitrary. Bug S1 ACTIVO. Migrar a resolveConfigForBike post-S4.`
        );
      }
      batteryConfig = candidates[0] ?? null;
    }

    if (!batteryConfig) {
      return NextResponse.json({ success: true, data: { requiredQuantity: 1, lots: [] } });
    }

    const { batteryVariantId, quantity: requiredQuantity } = batteryConfig;
    const branchFilter = role === "ADMIN" ? {} : { branchId: order.branchId };

    // 3. Lotes candidatos: del tipo correcto y con baterías disponibles (IN_STOCK y no
    //    pre-reservadas para otra AssemblyOrder; las pre-reservadas para ESTA orden sí cuentan).
    const batteryFilter = {
      status: "IN_STOCK" as const,
      OR: [
        { assemblyOrderId: null },
        { assemblyOrderId: id },
      ],
    };

    const lots = await prisma.batteryLot.findMany({
      where: {
        productVariantId: batteryVariantId,
        ...branchFilter,
        batteries: { some: batteryFilter },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
      select: {
        id: true,
        reference: true,
        supplier: true,
        receivedAt: true,
        batteries: {
          where: batteryFilter,
          orderBy: { createdAt: "asc" },
          take: requiredQuantity,
          select: { serialNumber: true },
        },
        _count: {
          select: { batteries: { where: batteryFilter } },
        },
      },
    });

    const data = lots
      .filter((l) => l._count.batteries >= requiredQuantity)
      .map((l) => ({
        lotId: l.id,
        reference: l.reference ?? l.id.slice(-6).toUpperCase(),
        supplier: l.supplier,
        receivedAt: l.receivedAt.toISOString(),
        inStock: l._count.batteries,
        serials: l.batteries.map((b) => b.serialNumber),
      }));

    return NextResponse.json({ success: true, data: { requiredQuantity, lots: data } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener baterías";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
