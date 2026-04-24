import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewBranchId } from "@/lib/branch-filter";
import type { TechnicianOption } from "@/lib/workshop-types";

// GET /api/workshop/technicians
// Retorna técnicos y encargados activos de la sucursal efectiva
// (JWT para MANAGER/TECHNICIAN, filtro del topbar para ADMIN).
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const branchId = await getViewBranchId();

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 },
    );
  }

  const rows = await prisma.user.findMany({
    where: {
      branchId,
      isActive: true,
      role: { in: ["TECHNICIAN", "MANAGER"] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const data: TechnicianOption[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role as "TECHNICIAN" | "MANAGER",
  }));

  return NextResponse.json({ success: true, data });
}
