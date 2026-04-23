import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";

// PATCH /api/customers/[id]/restore — revertir soft-delete. MANAGER+.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isManagerPlus(user.role)) {
    return NextResponse.json({ success: false, error: "Requiere rol MANAGER+" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: { deletedAt: null, deletedReason: null },
    });
    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("[api/customers/[id]/restore PATCH]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
