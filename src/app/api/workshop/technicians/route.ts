import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TechnicianOption } from "@/lib/workshop-types";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

// GET /api/workshop/technicians
// Retorna técnicos y encargados activos de la sucursal del usuario.
// ADMIN puede filtrar por ?branchId=<id>.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const url = new URL(req.url);

  let branchId: string | null;
  if (user.role === "ADMIN") {
    branchId = url.searchParams.get("branchId");
  } else {
    branchId = user.branchId;
  }

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Sucursal no especificada" },
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
