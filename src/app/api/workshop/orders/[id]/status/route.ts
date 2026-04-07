import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ServiceOrderStatus } from "@prisma/client";

const statusSchema = z.object({
  currentStatus: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"]),
});

// PATCH /api/workshop/orders/[id]/status — avanzar estado Kanban
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: orderId } = await params;

  const body: unknown = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Estado inválido" }, { status: 400 });
  }

  const { currentStatus } = parsed.data;

  let newStatus: ServiceOrderStatus;
  switch (currentStatus) {
    case "PENDING":
      newStatus = "IN_PROGRESS";
      break;
    case "IN_PROGRESS":
      newStatus = "COMPLETED";
      break;
    default:
      return NextResponse.json(
        { success: false, error: "Estado no válido para avanzar." },
        { status: 400 }
      );
  }

  try {
    const updated = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, data: { newStatus: updated.status } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al actualizar el estado";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
