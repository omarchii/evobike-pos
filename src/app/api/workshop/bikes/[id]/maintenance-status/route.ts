import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBikeMaintenanceStatus } from "@/lib/workshop-maintenance";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const user = session.user as unknown as SessionUser;
  if (user.role === "SELLER") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const branchId = await getViewBranchId();
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 },
    );
  }
  const { id } = await params;

  // Ownership gate: la bici debe pertenecer al branch efectivo.
  const bike = await prisma.customerBike.findUnique({
    where: { id },
    select: { branchId: true },
  });
  if (!bike || bike.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "Bicicleta no encontrada" }, { status: 404 });
  }

  const status = await getBikeMaintenanceStatus(id);

  return NextResponse.json({
    success: true,
    data: status
      ? {
          nivel: status.nivel,
          diasRestantes: status.diasRestantes,
          proximaFecha: status.proximaFecha.toISOString(),
          baseFecha: status.baseFecha.toISOString(),
        }
      : null,
  });
}
