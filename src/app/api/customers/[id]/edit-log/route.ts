import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";

// GET /api/customers/[id]/edit-log
// MANAGER+ ve todo. SELLER/TECHNICIAN ve solo sus propias ediciones (BRIEF §7.4 tab Datos).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: customerId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const managerPlus = isManagerPlus(user.role);

  const logs = await prisma.customerEditLog.findMany({
    where: {
      customerId,
      ...(managerPlus ? {} : { userId: user.id }),
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: logs });
}
