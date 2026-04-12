import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const productVariantId = searchParams.get("productVariantId");

  if (!productVariantId) {
    return NextResponse.json(
      { success: false, error: "productVariantId es requerido" },
      { status: 400 }
    );
  }

  // branchId siempre del token JWT — nunca del query param
  const branchId = session.user.branchId;

  try {
    const bikes = await prisma.customerBike.findMany({
      where: {
        productVariantId,
        // ADMIN puede ver todas las sucursales; los demás roles filtran por su sucursal
        branchId: session.user.role === "ADMIN" ? undefined : branchId,
        customerId: null,
        // Solo motos que pasaron por el flujo de montaje (D4 y D5 del spec).
        // CustomerBike sin AssemblyOrder COMPLETED no están listas para venta.
        assemblyOrders: {
          some: { status: "COMPLETED" },
        },
      },
      select: {
        id: true,
        serialNumber: true,
        voltaje: true,   // campo String? en CustomerBike (texto libre del ensamble)
        branchId: true,
        customerId: true,
        productVariantId: true,
        createdAt: true,
        productVariant: {
          select: {
            id: true,
            modelo: { select: { id: true, nombre: true } },
            color:  { select: { id: true, nombre: true } },
            voltaje: { select: { id: true, label: true, valor: true } },
          },
        },
        assemblyOrders: {
          where: { status: "COMPLETED" },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, completedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: bikes });
  } catch (error) {
    console.error("[customer-bikes/available]", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
