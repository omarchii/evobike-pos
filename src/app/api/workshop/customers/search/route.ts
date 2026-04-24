import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewBranchId } from "@/lib/branch-filter";
import { normalizeForSearch } from "@/lib/customers/normalize";
import type { SessionUser } from "@/lib/auth-types";

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { nameNormalized: { contains: normalizeForSearch(q) } },
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
