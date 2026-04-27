import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { REPORTS_BY_SLUG } from "@/lib/reportes/reports-config";
import type { ReportRole } from "@/lib/reportes/reports-config";
import { getSaleDetail } from "@/app/(pos)/reportes/ventas-e-ingresos/queries";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const reportMeta = REPORTS_BY_SLUG["ventas-e-ingresos"];
  if (!reportMeta?.allowedRoles.includes(user.role as ReportRole)) {
    return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id || typeof id !== "string") {
    return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
  }

  const detail = await getSaleDetail(id);
  if (!detail) {
    return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: detail });
}
