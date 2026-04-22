import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBikeMaintenanceStatus } from "@/lib/workshop-maintenance";

interface SessionUser {
  role: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { role } = session.user as unknown as SessionUser;
  if (role === "SELLER") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
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
