import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    // 1. Cargar la orden y su variante de producto
    const order = await prisma.assemblyOrder.findUnique({
      where: { id },
      select: {
        branchId: true,
        productVariantId: true,
        productVariant: {
          select: { modelo_id: true, voltaje_id: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    if (role !== "ADMIN" && order.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    if (!order.productVariant) {
      // Orden manual sin productVariant — no podemos determinar el tipo de batería
      return NextResponse.json({ success: true, data: { requiredQuantity: 1, lots: [] } });
    }

    // 2. Obtener BatteryConfiguration para saber tipo y cantidad
    const batteryConfig = await prisma.batteryConfiguration.findFirst({
      where: {
        modeloId: order.productVariant.modelo_id,
        voltajeId: order.productVariant.voltaje_id,
      },
      select: { batteryVariantId: true, quantity: true },
    });

    if (!batteryConfig) {
      return NextResponse.json({ success: true, data: { requiredQuantity: 1, lots: [] } });
    }

    const { batteryVariantId, quantity: requiredQuantity } = batteryConfig;
    const branchFilter = role === "ADMIN" ? {} : { branchId: order.branchId };

    // 3. Buscar lotes del tipo correcto con baterías IN_STOCK
    const lots = await prisma.batteryLot.findMany({
      where: {
        productVariantId: batteryVariantId,
        ...branchFilter,
        batteries: {
          some: { status: "IN_STOCK" },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
      select: {
        id: true,
        reference: true,
        supplier: true,
        receivedAt: true,
        batteries: {
          where: { status: "IN_STOCK" },
          orderBy: { createdAt: "asc" },
          take: requiredQuantity,
          select: { serialNumber: true },
        },
        _count: {
          select: { batteries: { where: { status: "IN_STOCK" } } },
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
