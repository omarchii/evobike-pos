import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { role, branchId } = session.user as unknown as BranchedSessionUser;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden marcar recepciones como pagadas" },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.findUnique({
        where: { id },
        select: { id: true, branchId: true, estadoPago: true },
      });
      if (!receipt) {
        return { error: "Recepción no encontrada", status: 404 as const };
      }
      if (role !== "ADMIN" && receipt.branchId !== branchId) {
        return { error: "Recepción de otra sucursal", status: 403 as const };
      }
      if (receipt.estadoPago === "PAGADA") {
        return { error: "La recepción ya está marcada como pagada", status: 409 as const };
      }

      const updated = await tx.purchaseReceipt.update({
        where: { id },
        data: { estadoPago: "PAGADA", fechaPago: new Date() },
        select: { id: true, estadoPago: true, fechaPago: true },
      });
      return { updated };
    });

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        id: result.updated.id,
        estadoPago: result.updated.estadoPago,
        fechaPago: result.updated.fechaPago?.toISOString() ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al marcar como pagada";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
