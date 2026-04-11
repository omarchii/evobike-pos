import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
}

const addItemSchema = z.object({
  productVariantId: z.string().optional(),
  description: z.string().min(1, "La descripción es obligatoria"),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const removeItemSchema = z.object({
  itemId: z.string().min(1, "ID de ítem requerido"),
});

// POST /api/workshop/orders/[id]/items — agregar concepto a la orden
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId } = session.user as unknown as SessionUser;

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Empleado sin sucursal asignada" }, { status: 400 });
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "No se puede modificar una orden cerrada/cancelada" },
        { status: 400 }
      );
    }

    // Nota: el descuento de stock ocurre al ENTREGAR la orden (D3 del spec),
    // no al agregar la refacción. El endpoint deliver valida stock e impacta
    // inventario atómicamente. Ver /api/service-orders/[id]/deliver.
    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderItem.create({
        data: {
          serviceOrderId,
          productVariantId: data.productVariantId ?? null,
          description: data.description,
          quantity: data.quantity,
          price: data.price,
        },
      });

      const items = await tx.serviceOrderItem.findMany({ where: { serviceOrderId } });
      const subtotal = items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { subtotal, total: subtotal },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al agregar el concepto";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/workshop/orders/[id]/items — eliminar concepto de la orden
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = removeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "ID de ítem requerido" }, { status: 400 });
  }

  const { itemId } = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "No se puede modificar una orden cerrada" },
        { status: 400 }
      );
    }

    await prisma.serviceOrderItem.delete({ where: { id: itemId } });

    const items = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId } });
    const subtotal = items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

    await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { subtotal, total: subtotal },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al eliminar el concepto";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
