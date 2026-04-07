import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/batteries/check?serial=X&branchId=Y
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const serial = searchParams.get("serial");
  const branchId = searchParams.get("branchId");

  if (!serial || !branchId) {
    return NextResponse.json({ error: "serial y branchId son requeridos" }, { status: 400 });
  }

  try {
    const battery = await prisma.battery.findFirst({
      where: { serialNumber: serial, branchId },
      include: {
        lot: {
          select: {
            id: true,
            reference: true,
            supplier: true,
          },
        },
      },
    });

    if (!battery) {
      return NextResponse.json({
        found: false,
        status: null,
        message: "Serial no encontrado en esta sucursal",
      });
    }

    if (battery.status !== "IN_STOCK") {
      return NextResponse.json({
        found: true,
        status: battery.status,
        message: `Batería con status: ${battery.status}. Solo se pueden asignar baterías IN_STOCK.`,
        lot: battery.lot,
      });
    }

    return NextResponse.json({
      found: true,
      status: battery.status,
      batteryId: battery.id,
      message: "OK",
      lot: battery.lot,
    });
  } catch (error) {
    console.error("Error validando batería:", error);
    return NextResponse.json({ error: "Error al validar la batería" }, { status: 500 });
  }
}
