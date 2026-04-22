import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { branchId, role } = session.user as unknown as SessionUser;

  if (role === "SELLER") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { rfc: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      rfc: true,
      bikes: {
        where: { branchId },
        select: {
          id: true,
          brand: true,
          model: true,
          serialNumber: true,
          color: true,
        },
      },
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: customers });
}
