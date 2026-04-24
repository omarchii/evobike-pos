import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";
import {
  MOBILE_ORDER_SELECT,
  serializeMobileOrder,
} from "@/lib/workshop-mobile";

// GET /api/workshop/orders/unassigned
// Órdenes sin técnico asignado del branch efectivo, aún activas
// (PENDING o IN_PROGRESS). Consumido por el FAB "+" del dashboard móvil
// del técnico para que pueda tomarse una orden libre.
//
// Rol permitido: TECHNICIAN, MANAGER, ADMIN. SELLER queda fuera.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  if (user.role === "SELLER") {
    return NextResponse.json(
      { success: false, error: "Sin permisos" },
      { status: 403 },
    );
  }

  const branchId = await getViewBranchId();
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 },
    );
  }

  const rows = await prisma.serviceOrder.findMany({
    where: {
      branchId,
      assignedTechId: null,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    select: MOBILE_ORDER_SELECT,
    orderBy: { createdAt: "asc" },
  });

  console.log(
    "[workshop-mobile]",
    JSON.stringify({
      userId: user.id,
      role: user.role,
      action: "list-unassigned",
      count: rows.length,
      mobileClient: req.headers.get("x-client") === "mobile-dashboard",
      ts: new Date().toISOString(),
    }),
  );

  return NextResponse.json({
    success: true,
    data: rows.map(serializeMobileOrder),
  });
}
